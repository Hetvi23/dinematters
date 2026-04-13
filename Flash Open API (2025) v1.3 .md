# **Credentials**

# 

# **Staging** Base URL: https://riderapi-staging.uengage.in

# storeId/store\_id: 89

# access-token: grdgedhs  **Production** Base URL: https://open-api.flash.uengage.in

Please note that these staging credentials are intended **only for testing the integration flow**. They cannot be used to perform actual serviceability checks or to create real tasks.

For a **Production Access Token** and **Store ID**, please contact the **uEngage Team**.

# 

# **Serviceability API(Recommended)**

   

## **Overview**

The Get Serviceability API allows users to check the serviceability of a specific location for a given store and partner. It requires authentication using an access token and accepts a JSON request body containing the necessary parameters.

     
**Header**

| Header Name | Required | Description |
| :---: | :---: | ----- |
| access-token | Yes | A unique token for authentication and authorization. |
| Content-Type | Yes | Indicates that the request body is in JSON format. |

| Sr. No. | Data |
| :---: | :---: |
| 1 | HTTP Method: Post |
| 2 | Endpoint: \<hostUrl\>/getServiceability |
|  3 | Header: Content-type: application/json  Access-Token: 123456 |

**Request Payload**

| Field | Type | Description | Required |
| :---: | :---: | :---: | :---: |
| store\_id | string | The unique identifier of the store. | Yes |
| pickupDetails | object | Details about the pickup location. | Yes |
| latitude | float | The latitude coordinate of the pickup location. | Yes |
| longitude | float | The longitude coordinate of the pickup location. | Yes |
| dropDetails | object | Details about the drop location. | Yes |
| latitude | float | The latitude coordinate of the drop location. | Yes |
| longitude | float | The longitude coordinate of the drop location. | Yes |

| Sr. No. | Data |  |
| :---: | ----- | :---- |
|  | { |  |
|  |  | "store\_id" : "89", |
|  |  | "pickupDetails" : { |
|  |  | "latitude":"28.39232449", |
|  |  | "longitude":"77.34029003" |
| 1 |  | }, |
|  |  | "dropDetails": { |
|  |  | "latitude":"28.409860071476828", |
|  |  | "longitude":"77.31229623779655" |
|  |  |    } |
|  | } |  |

**Successful Response**

| Field | Type | Description |
| :---: | :---: | :---: |
| status | string | The HTTP status code indicates the success of the request. |
| serviceability | object | Contains serviceability status information. |
| riderServiceAble | boolean | Indicates if rider service is available for the location |
| locationServiceAble | boolean | Indicates if location service is available for the location |
| payouts | object | Contains payout information. |
| total | float | The total payout amount. |
| price | float | The base price before tax. |
| tax | float | The tax amount. |

| Sr. No. | Data |
| ----- | ----- |
|  1 | { "status": "200", "serviceability": { "riderServiceAble": true, "locationServiceAble": true }, "payouts": { "total": 60.77, "price": 51.95, "tax": 8.82 } } |

**Error Response**

| Sr. No. | Data |
| ----- | ----- |
|  1 | {   "status": "200",   "serviceability": {     "riderServiceAble": false,     "locationServiceAble": false   },   "payouts": {     "message": "Rider not available"   } } |

# 

# **Create Task API(Minimum Requirement)**

## **Overview**

The Create Task API allows you to create a new task related to an order. It processes the order details, pickup and dropoff information, and the items included in the order.

**Header**

| Header Name | Required | Description |
| :---: | :---: | ----- |
| access-token | Yes | A unique token for authentication and authorization. |
| Content-Type | Yes | Indicates that the request body is in JSON format. |

| Sr. No. | Data |
| :---: | ----- |
| 1 | HTTP Method: Post |
| 2 | Endpoint: \<hostUrl\>/createTask |
|  3 | Header: Content-type: application/json, Access-Token: 123456 |

**Request Payload**

| Field | Type | Description | Required |
| ----- | ----- | ----- | :---: |
| storeId | string | The unique identifier for the store. | Yes |
| order\_details | object | Contains details about the order. | Yes |
| order\_total | number | The total amount of the order. | Yes |
| paid | string | Indicates whether the order is paid or cod. | Yes |
| vendor\_order\_id | string | The unique identifier of the vendor order id. Should be recognizable by the Outlet Team as riders will be asking for this only. | Yes |
| order\_source | string | The source of the order (e.g., pos,website,app). | Yes |
| customer\_orderId | string | The customer's order ID is optional. | No |
| pickup\_details | object | Information about the pickup location. | Yes |
| name | string | The name of the pickup location (e.g., Restaurant name). | Yes |
| contact\_number | string | The contact number of the pickup location. | Yes |
| latitude | number | The latitude coordinate of the pickup location. | Yes |
| longitude | number | The longitude coordinate of the pickup location. | Yes |
| address | string | The address of the pickup location. | Yes |
| city | string | The city of the pickup location. | Yes |
| state | string | The state of the pickup location. | No |
| drop\_details | object | Information about the drop-off location. | Yes |
| name | string | The name of the dropoff location (e.g., Customer name). | Yes |
| contact\_number | string | The contact number of the drop-off location. | Yes |
| latitude | number | The latitude coordinate of the drop-off location. | Yes |
| longitude | number | The longitude coordinate of the drop-off location. | Yes |
| address | string | The address of the dropoff location. | Yes |
| city | string | The city of the dropoff location. | Yes |
| State | string | The state of the drop location. | No |
| order\_items | array | A list of items included in the order. | No |
| id | string | The ID of the item. | No |
| quantity | number | The quantity of the item. | No |
| price | number | The price of the item. | No |
| authentication | object | Optional | No |
| delivery\_otp | string | OTP to be sent to Customer | No |
| rto\_otp | string | OTP to be sent to the Merchant | No |

| Sr. No. | Data |
| ----- | ----- |
|  1 | {   "storeId": "ABC89",   "order\_details": {     "order\_total": 456,     "paid": "true",     "vendor\_order\_id":   "1234213232",     "order\_source": "pos",     "customer\_orderId": ""   },   "pickup\_details": {     "name": "Restaurant name",     "contact\_number": "8923404812",     "latitude": 28.599735,     "longitude": 77.081755,     "address": "building name, area, city, state, pincode",     "city": "city”   },   "drop\_details": {     "name": "Customer name",     "contact\_number": "1232123212",     "latitude": 28.586317746533197,     "longitude": 77.07144459709525,     "address": "building name, area, city, state, pincode",     "city": "city"   },   "order\_items": \[     {       "id": "12",       "name": "Item name",       "quantity": 2,       "price": 102     }   \],   "authentication": {     "delivery\_otp": "1234",     "rto\_otp": "1234"   } } |

 **Successful Response**

| Field | Type | Description |
| ----- | ----- | ----- |
| status | boolean | Indicates whether the task creation was successful. |
| vendor\_order\_id | string | The unique identifier of the vendor order. |
| TaskId | string | The unique identifier of the created task. |
| message | string | A confirmation message indicating the success of task creation. |
| Status\_code | string | A code indicating the status of the request acceptance. |

| Sr. No. | Data |
| ----- | ----- |
|  1 | { "status": true, "vendor\_order\_id": "123421UEN3232", "taskId": "XXXXXUENXXXX", "message": "Task created",  "Status\_code": "ACCEPTED" } |

**Error Response**

| Sr. No. | Data |
| :---: | ----- |
|  1 | {  "status": false,  "vendor\_order\_id": "123421UEN3232",  "message": "Rider not Available",  "Status\_code": "CANCELLED" } |

# 

# 

# 

# **Track Task Status API(Optional)**

## **Overview**

The Track Task Status API allows users to track the status of a task associated with a specific store and vendor order ID. It requires authentication using an access token and accepts a JSON request body containing the necessary parameters.

**Header**

| Header Name | Required | Description |
| :---- | :---: | ----- |
| access-token | Yes | A unique token for authentication and authorization. |
| Content-Type | Yes | Indicates that the request body is in JSON format. |

| Sr. No. | Data |
| :---: | ----- |
| 1 | HTTP Method: Post |
| 2 | Endpoint: \<hostUrl\>/trackTaskStatus |
| 3 | Header: Content-type: application/json, Access-token: 123456 |

**Request Payload**

| Field | Type | Description |
| :---- | ----- | ----- |
| storeId | string | The unique identifier for the store. |
| taskId | string | The unique identifier of the task order id. |

| Sr. No. | Data |
| :---: | ----- |
|  1 | { "storeId": "89", "taskId": "XXXXUENXXXXX" } |

**Successful Response**

| Field | Type | Description |
| :---: | :---: | ----- |
| status | boolean | The HTTP status code indicates the success of the request. |
| message | string | Contains any additional message |
| status\_code |   string | Contains current status of the Task  |
| data | object | Contains payout information. |
| taskId | string | uEngage ID |
| vendor\_order\_id | string | Order Id |
| partner\_name | string | Partner Name |
| rider\_name | string | Rider Name |
| rider\_contact | string | Rider Contact Number |
| latitude | string | Location Latitude of the Rider |
| longitude | string | Location Longitude of the Rider |
| tracking\_url | string | URL for Tracking Task |
| rto\_reason | string | RTO Reason (when applicable) |

| Sr. No. | Data |
| :---- | ----- |
|  1 | {   "status": true,   "message": "Ok",   "status\_code": "ALLOTTED",   "data": {     "taskId": "XXXUENXXX",     "vendor\_order\_id": "701650917UEN05667974",     "partner\_name": "ABC",    "rider\_name": "Rahul Shukla",     "rider\_contact": "836XXXX991",     "latitude": "30.712492771245206",     "longitude": "76.84763254874433",    "tracking\_url": "[https://uen.io/track/abc](https://uen.io/track/abc)",     "rto\_reason": "Reason for Return",   } } |

| Event Status | Description |
| ----- | ----- |
| **ACCEPTED** | **Order Created Successfully.** |
| **ALLOTTED** | **Rider Allotted to pick up the items.** |
| **ARRIVED** | **Rider has reached the pickup location.** |
| **DISPATCHED** | **Order is picked up by the rider.** |
| **ARRIVED\_CUSTOMER\_DOORSTEP** | **Rider has reached the drop-off location.** |
| **DELIVERED** | **Successfully delivered, and the transaction has concluded.** |
| **RTO\_INIT** | **RTO is initiated** |
| **RTO\_COMPLETE** | **RTO is completed** |
| **CANCELLED** | **Task is cancelled** |
| **SEARCHING\_FOR\_NEW\_RIDER** | **Searching for a new rider when Auto Re-allocation happens.** |

**Error Response**

| Sr. No. | Data |
| ----- | ----- |
|  1 |  {  "message":"Invalid Token",  "status":"400" } |

# 

# 

# 

# 

# 

# 

# 

# **Cancel Task API(Minimum Requirement)**

## **Overview**

The Cancel Task API allows users to cancel a task associated with a specific order.

**Header**

| Header Name | Required | Description |
| ----- | :---: | ----- |
| access-token | Yes | A unique token for authentication and authorization. |
| Content-Type | Yes | Indicates that the request body is in JSON format. |

| Sr. No. | Data |
| :---- | ----- |
| 1 | HTTP Method: Post |
| 2 | Endpoint: \<hostUrl\>/cancelTask |
| 3 | Header: Content-type: application/json, Access-token: 123456 |

**Request Payload**

| Field Name | Type | Description |
| :---- | :---- | ----- |
| storeId | string | The unique identifier for the store. |
| taskId | string | The unique identifier of the task order id. |

| Sr. No. | Data |
| :---- | ----- |
|  1 | { "storeId": "89", "taskId": "XXXXUENXXXXX" } |

**Successful Response**

| Field | Type | Description |
| :---- | ----- | ----- |
| status | Boolean | Indicates the success of the cancellation operation |
| message | String | A descriptive message about the cancellation outcome. |
| status\_code | String | A code representing the new status of the task |

| Sr. No. | Data |
| ----- | ----- |
| 1 | { "status": true, "status\_code": "CANCELLED", "message": "Order has been cancelled" }  |

**Error Response**

| Sr. No. | Data |
| ----- | ----- |
|  1 |  {"message":"Invalid Token","status":"400"} |

# 

# 

# 

# 

# 

# **Callback API(Minimum Requirement)**

## **Overview**

This documentation describes the Callback API that pushes real-time status updates to a specified endpoint regarding the progress of an order. The updates are triggered by changes in the event status of the order lifecycle, from creation through delivery.

**Callback URL**

Your system must provide a URL endpoint that is capable of receiving POST requests. This URL will be used to push the status updates as they occur.

**Request Payload**

| Sr. No. | Data |
| ----- | ----- |
| 1 | HTTP Method: Post |
| 2 | Endpoint: \<hostUrl\>/Endpoint |

| Field | Type | Description |
| ----- | ----- | ----- |
| status | boolean | Indicates the success of the operation. |
| data | object | Contains information about the task and rider. |
| taskId | string | The unique identifier of the task. |
| rider\_name | string | The name of the assigned rider. |
| rider\_contact | string | The contact number of the assigned rider. |
| latitude | string | Latitude of Rider Location |
| longitude | string | Longitude of Rider Location |
| rto\_reason | string | Reason for RTO (when applicable) |
| message | string | A descriptive message indicating the status. |
| status\_code | string | The code indicates the status of the operation. |

| Sr. No. | Data |
| ----- | ----- |
|  1 | {   "status": true,   "data": {     "taskId": "XXXXUENXXXXX",     "orderId": "7016ABCDEF67974",     "partner\_name": "Porter",     "rider\_name": "Ravit Kumar",     "rider\_contact": "991XXXX131",     "latitude": "30.712518036454355",     "longitude": "76.84761827964336",     "tracking\_url": "[https://uen.io/track/abc](https://uen.io/track/m5g78eqnks)",     "rto\_reason": "Reason for Return",     "delivery\_otp": "XXXX"        // Can be null   },   "message": "Ok",   "status\_code": "DELIVERED" } |

| Event Status | Description |
| ----- | ----- |
| **ACCEPTED** | **Order Created Successfully.** |
| **ALLOTTED** | **Rider Allotted to pick up the items.** |
| **ARRIVED** | **The rider has reached the pickup location.** |
| **DISPATCHED** | **Order is picked up by the rider.** |
| **ARRIVED\_CUSTOMER\_DOORSTEP** | **Rider has reached the drop-off location.** |
| **DELIVERED** | **Successfully delivered, and the transaction has concluded.** |
| **RTO\_INIT** | **RTO is initiated** |
| **RTO\_COMPLETE** | **RTO is completed** |
| **CANCELLED** | **Order is cancelled** |
| **SEARCHING\_FOR\_NEW\_RIDER** | **Searching for a new rider when Auto Re-allocation happens.** |
| **RETURNED\_AFTER\_DELIVERY** | **For Self Riders (If enabled)** |

**Successful Response**

| Sr. No. | Data |
| ----- | ----- |
| 1 | { "status": true, "message": "Webhook Processed" } |

| HTTP Status Code |  Error Response |  Description |
| :---- | ----- | ----- |
|  400 | {"error": "Bad Request", "message": "The request was invalid or malformed."} | Indicates that the request was invalid or malformed. |
|  401 | {"error": "Unauthorized", "message": "Authentication is required."} | Indicates that authentication is required to access the resource. |
|  404 | {"error": "Not Found", "message": "The requested resource was not found."} | Indicates that the requested resource was not found. |

