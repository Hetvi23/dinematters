"""Error handling middleware"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


async def error_handler_middleware(request: Request, call_next):
	"""
	Global error handler middleware
	
	STRICT RULE: Pass through ERPNext errors unchanged
	"""
	try:
		response = await call_next(request)
		return response
	except Exception as e:
		logger.error(f"Unhandled error: {str(e)}", exc_info=True)
		
		# Return error in Frappe format
		return JSONResponse(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			content={
				"exc_type": "ServerError",
				"exception": str(e),
				"_server_messages": "Internal server error"
			}
		)

