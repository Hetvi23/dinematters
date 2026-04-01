import frappe
from abc import ABC, abstractmethod

class POSProvider(ABC):
    def __init__(self, restaurant_doc):
        self.restaurant = restaurant_doc
        self.settings = {
            "app_key": restaurant_doc.pos_app_key,
            "app_secret": restaurant_doc.get_password("pos_app_secret"),
            "access_token": restaurant_doc.get_password("pos_access_token") if hasattr(restaurant_doc, 'pos_access_token') else None,
            "merchant_id": restaurant_doc.pos_merchant_id
        }

    @abstractmethod
    def sync_menu(self):
        """Fetch and sync menu from POS to Dinematters"""
        pass

    @abstractmethod
    def push_order(self, order_doc):
        """Push a confirmed order to POS"""
        pass

    @abstractmethod
    def handle_callback(self, data):
        """Handle status update callbacks from POS"""
        pass

def get_pos_provider(restaurant_doc):
    if not restaurant_doc.pos_enabled or not restaurant_doc.pos_provider:
        return None
    
    if restaurant_doc.pos_provider == "Petpooja":
        from dinematters.dinematters.pos.petpooja import PetpoojaProvider
        return PetpoojaProvider(restaurant_doc)
    
    return None
