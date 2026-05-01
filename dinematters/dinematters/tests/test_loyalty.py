# Copyright (c) 2026, Dinematters and contributors
# For license information, please see license.txt

"""
Production-grade tests for utils/loyalty.py

Covers:
  - get_loyalty_balance()
      * Earn entries add to balance
      * Redeem entries subtract from balance
      * Expired entries are excluded
      * Unsettled entries excluded by default (include_pending=False)
      * include_pending=True includes unsettled entries
      * Balance is never negative (max(0, ...))
      * Empty returns zero

  - earn_loyalty_coins()
      * Coins calculated correctly from points_per_inr
      * is_settled=0 for Order references
      * is_settled=1 for non-Order references
      * Expiry date set correctly
      * Returns 0 when loyalty is disabled
      * Returns 0 when no config exists (uses default 0.1 points_per_inr)

  - redeem_loyalty_coins()
      * Normal redemption creates Redeem entry
      * Caps at available balance (never redeems more than balance)
      * Returns None when loyalty is disabled
      * Returns None for zero or negative coins input

  - settle_loyalty_points()
      * Marks all Order-linked entries as is_settled=1
      * Idempotent (calling twice is safe)

  - handle_order_cancellation()
      * Refunds redeemed coins on cancellation
      * Reverts earned coins on cancellation
      * Idempotent: second cancellation call is a no-op
      * Non-cancelled status does not trigger refund/revert

  - handle_loyalty_settlement()
      * Settles when payment_status == "completed"
      * Settles when status == "billed"
      * Does NOT settle on "pending" status

Run with:
    bench run-tests --app dinematters --module dinematters.dinematters.tests.test_loyalty
"""

import unittest
import frappe
from frappe.utils import today, add_days, add_months
from unittest.mock import MagicMock, patch

from dinematters.dinematters.tests.utils import (
    make_restaurant,
    make_loyalty_config,
    make_customer,
    make_loyalty_entry,
    cleanup_restaurant,
    cleanup_restaurants_by_prefix,
    reset_restaurant_balance,
)

_PREFIX = "TEST-LOY"


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _clear_loyalty_entries(customer, restaurant):
    frappe.db.delete("Restaurant Loyalty Entry", {
        "customer": customer,
        "restaurant": restaurant,
    })
    frappe.db.commit()


# ─── 1. get_loyalty_balance() ─────────────────────────────────────────────────

class TestGetLoyaltyBalance(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        frappe.set_user("Administrator")
        cleanup_restaurants_by_prefix(_PREFIX + "-GLB-")
        cls._res = f"{_PREFIX}-GLB-{frappe.generate_hash(length=6)}"
        make_restaurant(cls._res, plan="DIAMOND")
        make_loyalty_config(cls._res, points_per_inr=0.1)
        cls._customer = make_customer(phone="9100000001", name="Test Balance Customer")

        from dinematters.dinematters.utils.loyalty import get_loyalty_balance
        cls.get_balance = staticmethod(get_loyalty_balance)

    @classmethod
    def tearDownClass(cls):
        cleanup_restaurant(cls._res)
        # Customer doc is shared; we only delete the loyalty entries
        frappe.db.delete("Restaurant Loyalty Entry", {"customer": cls._customer.name})
        frappe.db.commit()

    def setUp(self):
        _clear_loyalty_entries(self._customer.name, self._res)

    def test_empty_returns_zero(self):
        self.assertEqual(self.get_balance(self._customer.name, self._res), 0)

    def test_earn_entries_add_to_balance(self):
        make_loyalty_entry(self._customer.name, self._res, coins=100, is_settled=1)
        self.assertEqual(self.get_balance(self._customer.name, self._res), 100)

    def test_multiple_earn_entries_sum_correctly(self):
        make_loyalty_entry(self._customer.name, self._res, coins=100, is_settled=1)
        make_loyalty_entry(self._customer.name, self._res, coins=50, is_settled=1)
        self.assertEqual(self.get_balance(self._customer.name, self._res), 150)

    def test_redeem_entry_subtracts_from_balance(self):
        make_loyalty_entry(self._customer.name, self._res, coins=100, is_settled=1)
        make_loyalty_entry(self._customer.name, self._res, coins=30,
                           txn_type="Redeem", reason="Redemption", is_settled=1)
        self.assertEqual(self.get_balance(self._customer.name, self._res), 70)

    def test_balance_never_negative(self):
        """Even if redemptions exceed earnings, balance floors at zero."""
        make_loyalty_entry(self._customer.name, self._res, coins=200,
                           txn_type="Redeem", reason="Redemption", is_settled=1)
        balance = self.get_balance(self._customer.name, self._res)
        self.assertEqual(balance, 0)

    def test_expired_entries_excluded(self):
        """Entries with expiry_date in the past must not count."""
        # Settled earn entry that has already expired
        doc = frappe.get_doc({
            "doctype": "Restaurant Loyalty Entry",
            "customer": self._customer.name,
            "restaurant": self._res,
            "coins": 200,
            "transaction_type": "Earn",
            "reason": "Order",
            "posting_date": today(),
            "expiry_date": add_days(today(), -1),  # expired yesterday
            "is_settled": 1,
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        balance = self.get_balance(self._customer.name, self._res)
        self.assertEqual(balance, 0, "Expired entries must not contribute to balance")

    def test_unsettled_entries_excluded_by_default(self):
        """is_settled=0 entries are ignored when include_pending=False (default)."""
        make_loyalty_entry(self._customer.name, self._res, coins=100, is_settled=0)
        self.assertEqual(self.get_balance(self._customer.name, self._res), 0)

    def test_include_pending_includes_unsettled_entries(self):
        make_loyalty_entry(self._customer.name, self._res, coins=100, is_settled=0)
        balance = self.get_balance(self._customer.name, self._res, include_pending=True)
        self.assertEqual(balance, 100)

    def test_null_customer_returns_zero(self):
        self.assertEqual(self.get_balance(None, self._res), 0)

    def test_null_restaurant_returns_zero(self):
        self.assertEqual(self.get_balance(self._customer.name, None), 0)


# ─── 2. earn_loyalty_coins() ─────────────────────────────────────────────────

class TestEarnLoyaltyCoins(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        frappe.set_user("Administrator")
        cleanup_restaurants_by_prefix(_PREFIX + "-ELC-")
        cls._res = f"{_PREFIX}-ELC-{frappe.generate_hash(length=6)}"
        make_restaurant(cls._res, plan="DIAMOND")
        # points_per_inr=0.1 → 1 coin per ₹10 → ₹1000 order = 100 coins
        make_loyalty_config(cls._res, points_per_inr=0.1, loyalty_expiry_months=12)
        cls._customer = make_customer(phone="9100000002", name="Test Earn Customer")

        from dinematters.dinematters.utils.loyalty import earn_loyalty_coins
        cls.earn = staticmethod(earn_loyalty_coins)

    @classmethod
    def tearDownClass(cls):
        cleanup_restaurant(cls._res)
        frappe.db.delete("Restaurant Loyalty Entry", {"customer": cls._customer.name})
        frappe.db.commit()

    def setUp(self):
        _clear_loyalty_entries(self._customer.name, self._res)

    def test_coins_calculated_from_points_per_inr(self):
        """₹1000 order × 0.1 points_per_inr = 100 coins."""
        earned = self.earn(self._customer.name, self._res, 1000.0, reason="Order")
        self.assertEqual(earned, 100)

    def test_fractional_coins_truncated(self):
        """int() truncation: ₹105 × 0.1 = 10.5 → 10 coins."""
        earned = self.earn(self._customer.name, self._res, 105.0, reason="Order")
        self.assertEqual(earned, 10)

    def test_unsettled_for_order_reference(self):
        """Earning on an 'Order' ref_doctype must create is_settled=0."""
        self.earn(
            self._customer.name, self._res, 1000.0,
            reason="Order", ref_doctype="Order", ref_name="TEST-ORDER-001"
        )
        entry = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"customer": self._customer.name, "restaurant": self._res, "reason": "Order"},
            ["is_settled"],
            as_dict=True
        )
        self.assertIsNotNone(entry)
        self.assertEqual(entry.is_settled, 0)

    def test_settled_for_non_order_reference(self):
        """Earning on a non-Order ref_doctype must create is_settled=1."""
        self.earn(
            self._customer.name, self._res, 1000.0,
            reason="Referral Order", ref_doctype="Customer"
        )
        entry = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"customer": self._customer.name, "restaurant": self._res, "reason": "Referral Order"},
            ["is_settled"],
            as_dict=True
        )
        self.assertIsNotNone(entry)
        self.assertEqual(entry.is_settled, 1)

    def test_expiry_date_set_correctly(self):
        """expiry_date must be exactly loyalty_expiry_months (12) from today."""
        self.earn(self._customer.name, self._res, 1000.0, reason="Order")
        entry = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"customer": self._customer.name, "restaurant": self._res},
            ["expiry_date"],
            as_dict=True
        )
        expected_expiry = add_months(today(), 12)
        self.assertEqual(str(entry.expiry_date), str(expected_expiry))

    def test_zero_amount_returns_zero(self):
        earned = self.earn(self._customer.name, self._res, 0.0)
        self.assertEqual(earned, 0)

    def test_loyalty_disabled_returns_zero(self):
        """When enable_loyalty=0 on the restaurant, no coins are earned."""
        disabled_res = f"{_PREFIX}-ELC-DIS-{frappe.generate_hash(length=6)}"
        make_restaurant(disabled_res, plan="DIAMOND")
        # Explicitly disable loyalty (no config → is_loyalty_enabled returns False)
        try:
            earned = self.earn(self._customer.name, disabled_res, 1000.0)
            self.assertEqual(earned, 0)
        finally:
            cleanup_restaurant(disabled_res)


# ─── 3. redeem_loyalty_coins() ───────────────────────────────────────────────

class TestRedeemLoyaltyCoins(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        frappe.set_user("Administrator")
        cleanup_restaurants_by_prefix(_PREFIX + "-RLC-")
        cls._res = f"{_PREFIX}-RLC-{frappe.generate_hash(length=6)}"
        make_restaurant(cls._res, plan="DIAMOND")
        make_loyalty_config(cls._res, points_per_inr=0.1)
        cls._customer = make_customer(phone="9100000003", name="Test Redeem Customer")

        from dinematters.dinematters.utils.loyalty import redeem_loyalty_coins
        cls.redeem = staticmethod(redeem_loyalty_coins)

    @classmethod
    def tearDownClass(cls):
        cleanup_restaurant(cls._res)
        frappe.db.delete("Restaurant Loyalty Entry", {"customer": cls._customer.name})
        frappe.db.commit()

    def setUp(self):
        _clear_loyalty_entries(self._customer.name, self._res)

    def test_normal_redemption_creates_redeem_entry(self):
        make_loyalty_entry(self._customer.name, self._res, coins=200, is_settled=1)
        entry = self.redeem(self._customer.name, self._res, 50)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.transaction_type, "Redeem")
        self.assertEqual(entry.coins, 50)

    def test_redemption_capped_at_available_balance(self):
        """Trying to redeem 500 when balance is 100 must cap at 100."""
        make_loyalty_entry(self._customer.name, self._res, coins=100, is_settled=1)
        entry = self.redeem(self._customer.name, self._res, 500)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.coins, 100, "Redemption must be capped at available balance")

    def test_redeem_returns_none_when_no_balance(self):
        entry = self.redeem(self._customer.name, self._res, 50)
        self.assertIsNone(entry)

    def test_redeem_returns_none_for_zero_coins(self):
        entry = self.redeem(self._customer.name, self._res, 0)
        self.assertIsNone(entry)

    def test_redeem_returns_none_for_negative_coins(self):
        entry = self.redeem(self._customer.name, self._res, -10)
        self.assertIsNone(entry)

    def test_redeem_returns_none_when_loyalty_disabled(self):
        disabled_res = f"{_PREFIX}-RLC-DIS-{frappe.generate_hash(length=6)}"
        make_restaurant(disabled_res, plan="DIAMOND")
        # No loyalty config → is_loyalty_enabled returns False
        try:
            entry = self.redeem(self._customer.name, disabled_res, 50)
            self.assertIsNone(entry)
        finally:
            cleanup_restaurant(disabled_res)


# ─── 4. settle_loyalty_points() ──────────────────────────────────────────────

class TestSettleLoyaltyPoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        frappe.set_user("Administrator")
        cleanup_restaurants_by_prefix(_PREFIX + "-SLP-")
        cls._res = f"{_PREFIX}-SLP-{frappe.generate_hash(length=6)}"
        make_restaurant(cls._res, plan="DIAMOND")
        make_loyalty_config(cls._res)
        cls._customer = make_customer(phone="9100000004", name="Test Settle Customer")

        from dinematters.dinematters.utils.loyalty import settle_loyalty_points
        cls.settle = staticmethod(settle_loyalty_points)

    @classmethod
    def tearDownClass(cls):
        cleanup_restaurant(cls._res)
        frappe.db.delete("Restaurant Loyalty Entry", {"customer": cls._customer.name})
        frappe.db.commit()

    def setUp(self):
        _clear_loyalty_entries(self._customer.name, self._res)

    def _make_unsettled_order_entry(self, order_name):
        return frappe.get_doc({
            "doctype": "Restaurant Loyalty Entry",
            "customer": self._customer.name,
            "restaurant": self._res,
            "coins": 50,
            "transaction_type": "Earn",
            "reason": "Order",
            "posting_date": today(),
            "expiry_date": add_days(today(), 365),
            "is_settled": 0,
            "reference_doctype": "Order",
            "reference_name": order_name,
        }).insert(ignore_permissions=True)

    def test_marks_order_entries_as_settled(self):
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        self._make_unsettled_order_entry(order_name)
        frappe.db.commit()

        result = self.settle(order_name)
        self.assertTrue(result)

        is_settled = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"reference_name": order_name, "reference_doctype": "Order"},
            "is_settled"
        )
        self.assertEqual(is_settled, 1)

    def test_idempotent_double_settle(self):
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        self._make_unsettled_order_entry(order_name)
        frappe.db.commit()

        self.settle(order_name)
        result = self.settle(order_name)  # second call must not raise
        self.assertTrue(result)

    def test_only_settles_matching_order(self):
        """Settling order A must not affect order B entries."""
        order_a = f"TEST-ORD-A-{frappe.generate_hash(length=6)}"
        order_b = f"TEST-ORD-B-{frappe.generate_hash(length=6)}"
        self._make_unsettled_order_entry(order_a)
        self._make_unsettled_order_entry(order_b)
        frappe.db.commit()

        self.settle(order_a)

        settled_b = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"reference_name": order_b, "reference_doctype": "Order"},
            "is_settled"
        )
        self.assertEqual(settled_b, 0, "Order B must remain unsettled")


# ─── 5. handle_order_cancellation() ──────────────────────────────────────────

class TestHandleOrderCancellation(unittest.TestCase):
    """
    The cancellation hook must:
    1. Refund any redeemed loyalty coins (create an Earn entry with "Cancellation Refund")
    2. Revert any earned loyalty coins (create a Redeem entry with "Cancellation Revert")
    3. Be idempotent — a second call must not double-refund
    4. No-op when order status is not 'cancelled'
    """

    @classmethod
    def setUpClass(cls):
        frappe.set_user("Administrator")
        cleanup_restaurants_by_prefix(_PREFIX + "-HOC-")
        cls._res = f"{_PREFIX}-HOC-{frappe.generate_hash(length=6)}"
        make_restaurant(cls._res, plan="DIAMOND")
        make_loyalty_config(cls._res)
        cls._customer = make_customer(phone="9100000005", name="Test Cancel Customer")

        from dinematters.dinematters.utils.loyalty import handle_order_cancellation
        cls.cancel_hook = staticmethod(handle_order_cancellation)

    @classmethod
    def tearDownClass(cls):
        cleanup_restaurant(cls._res)
        frappe.db.delete("Restaurant Loyalty Entry", {"customer": cls._customer.name})
        frappe.db.commit()

    def setUp(self):
        _clear_loyalty_entries(self._customer.name, self._res)

    def _make_mock_order(self, status, coins_redeemed=0, coins_earned=0, order_name=None):
        """Return a MagicMock mimicking an Order document."""
        doc = MagicMock()
        doc.name = order_name or f"TEST-ORD-{frappe.generate_hash(length=8)}"
        doc.status = status
        doc.restaurant = self._res
        doc.platform_customer = self._customer.name
        doc.loyalty_coins_redeemed = coins_redeemed
        doc.coins_earned = coins_earned
        return doc

    def test_non_cancelled_status_is_noop(self):
        doc = self._make_mock_order(status="confirmed", coins_redeemed=50, coins_earned=100)
        self.cancel_hook(doc)
        count = frappe.db.count("Restaurant Loyalty Entry", {
            "customer": self._customer.name,
            "restaurant": self._res,
        })
        self.assertEqual(count, 0, "Hook must be a no-op for non-cancelled orders")

    def test_cancellation_refunds_redeemed_coins(self):
        """On cancellation, redeemed coins must be returned as an Earn entry."""
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        doc = self._make_mock_order(
            status="cancelled",
            coins_redeemed=100,
            coins_earned=0,
            order_name=order_name
        )
        self.cancel_hook(doc)

        refund_entry = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {
                "customer": self._customer.name,
                "restaurant": self._res,
                "reference_name": order_name,
                "reason": "Cancellation Refund",
            },
            ["coins", "transaction_type"],
            as_dict=True
        )
        self.assertIsNotNone(refund_entry, "Cancellation Refund entry must be created")
        self.assertEqual(refund_entry.transaction_type, "Earn")
        self.assertEqual(refund_entry.coins, 100)

    def test_cancellation_reverts_earned_coins(self):
        """On cancellation, earned coins must be reverted as a Redeem entry."""
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        # Pre-create a settled earn entry so there's balance to revert
        make_loyalty_entry(self._customer.name, self._res, coins=200, is_settled=1)
        doc = self._make_mock_order(
            status="cancelled",
            coins_redeemed=0,
            coins_earned=50,
            order_name=order_name
        )
        self.cancel_hook(doc)

        revert_entry = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {
                "customer": self._customer.name,
                "restaurant": self._res,
                "reference_name": order_name,
                "reason": "Cancellation Revert",
            },
            ["coins", "transaction_type"],
            as_dict=True
        )
        self.assertIsNotNone(revert_entry, "Cancellation Revert entry must be created")
        self.assertEqual(revert_entry.transaction_type, "Redeem")

    def test_idempotent_cancellation_hook(self):
        """Calling the hook twice must not create duplicate refund/revert entries."""
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        make_loyalty_entry(self._customer.name, self._res, coins=200, is_settled=1)
        doc = self._make_mock_order(
            status="cancelled",
            coins_redeemed=50,
            coins_earned=30,
            order_name=order_name
        )
        self.cancel_hook(doc)
        self.cancel_hook(doc)  # second call

        refund_count = frappe.db.count("Restaurant Loyalty Entry", {
            "customer": self._customer.name,
            "restaurant": self._res,
            "reference_name": order_name,
            "reason": "Cancellation Refund",
        })
        revert_count = frappe.db.count("Restaurant Loyalty Entry", {
            "customer": self._customer.name,
            "restaurant": self._res,
            "reference_name": order_name,
            "reason": "Cancellation Revert",
        })
        self.assertEqual(refund_count, 1, "Refund must be created exactly once")
        self.assertEqual(revert_count, 1, "Revert must be created exactly once")


# ─── 6. handle_loyalty_settlement() ──────────────────────────────────────────

class TestHandleLoyaltySettlement(unittest.TestCase):
    """
    The settlement hook must settle loyalty points when the order reaches
    a qualifying status, and must NOT settle on non-qualifying statuses.
    """

    @classmethod
    def setUpClass(cls):
        frappe.set_user("Administrator")
        cleanup_restaurants_by_prefix(_PREFIX + "-HLS-")
        cls._res = f"{_PREFIX}-HLS-{frappe.generate_hash(length=6)}"
        make_restaurant(cls._res, plan="DIAMOND")
        # earn_on_status="Completed" → settle on "completed", "billed", "confirmed", or payment_status=completed
        make_loyalty_config(cls._res, earn_on_status="Completed")
        cls._customer = make_customer(phone="9100000006", name="Test Settlement Customer")

        from dinematters.dinematters.utils.loyalty import handle_loyalty_settlement
        cls.settle_hook = staticmethod(handle_loyalty_settlement)

    @classmethod
    def tearDownClass(cls):
        cleanup_restaurant(cls._res)
        frappe.db.delete("Restaurant Loyalty Entry", {"customer": cls._customer.name})
        frappe.db.commit()

    def setUp(self):
        _clear_loyalty_entries(self._customer.name, self._res)

    def _make_order_doc(self, status, payment_status="pending", order_name=None):
        doc = MagicMock()
        doc.name = order_name or f"TEST-ORD-{frappe.generate_hash(length=8)}"
        doc.restaurant = self._res
        doc.status = status
        doc.payment_status = payment_status
        return doc

    def _make_unsettled_entry_for_order(self, order_name):
        return frappe.get_doc({
            "doctype": "Restaurant Loyalty Entry",
            "customer": self._customer.name,
            "restaurant": self._res,
            "coins": 100,
            "transaction_type": "Earn",
            "reason": "Order",
            "posting_date": today(),
            "expiry_date": add_days(today(), 365),
            "is_settled": 0,
            "reference_doctype": "Order",
            "reference_name": order_name,
        }).insert(ignore_permissions=True)

    def test_settles_on_payment_completed(self):
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        self._make_unsettled_entry_for_order(order_name)
        frappe.db.commit()

        doc = self._make_order_doc("confirmed", payment_status="completed", order_name=order_name)
        self.settle_hook(doc)

        settled = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"reference_name": order_name},
            "is_settled"
        )
        self.assertEqual(settled, 1)

    def test_settles_on_billed_status(self):
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        self._make_unsettled_entry_for_order(order_name)
        frappe.db.commit()

        doc = self._make_order_doc("billed", payment_status="pending", order_name=order_name)
        self.settle_hook(doc)

        settled = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"reference_name": order_name},
            "is_settled"
        )
        self.assertEqual(settled, 1)

    def test_does_not_settle_on_pending_status(self):
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        self._make_unsettled_entry_for_order(order_name)
        frappe.db.commit()

        doc = self._make_order_doc("pending", payment_status="pending", order_name=order_name)
        self.settle_hook(doc)

        settled = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"reference_name": order_name},
            "is_settled"
        )
        self.assertEqual(settled, 0, "Pending order must not settle loyalty points")

    def test_does_not_settle_on_accepted_status(self):
        order_name = f"TEST-ORD-{frappe.generate_hash(length=8)}"
        self._make_unsettled_entry_for_order(order_name)
        frappe.db.commit()

        doc = self._make_order_doc("accepted", payment_status="pending", order_name=order_name)
        self.settle_hook(doc)

        settled = frappe.db.get_value(
            "Restaurant Loyalty Entry",
            {"reference_name": order_name},
            "is_settled"
        )
        self.assertEqual(settled, 0, "Accepted order must not prematurely settle points")

    def test_no_restaurant_is_noop(self):
        """If doc.restaurant is None, the hook must not raise."""
        doc = self._make_order_doc("billed")
        doc.restaurant = None
        try:
            self.settle_hook(doc)  # must not raise
        except Exception as e:
            self.fail(f"Hook raised unexpectedly with no restaurant: {e}")


if __name__ == "__main__":
    unittest.main()
