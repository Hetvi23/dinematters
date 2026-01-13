"""Logging configuration"""

import logging
import sys
from pythonjsonlogger import jsonlogger

try:
	from ..config import settings
except ImportError:
	# Allow running as script
	import os
	import sys
	sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
	from config import settings


def setup_logging():
	"""Setup application logging"""
	
	# Create logger
	logger = logging.getLogger()
	logger.setLevel(getattr(logging, settings.log_level.upper()))
	
	# Remove existing handlers
	logger.handlers = []
	
	# Create handler
	handler = logging.StreamHandler(sys.stdout)
	
	# Set format based on configuration
	if settings.log_format == "json":
		formatter = jsonlogger.JsonFormatter(
			'%(timestamp)s %(level)s %(name)s %(message)s',
			timestamp=True
		)
	else:
		formatter = logging.Formatter(
			'%(asctime)s - %(name)s - %(levelname)s - %(message)s'
		)
	
	handler.setFormatter(formatter)
	logger.addHandler(handler)
	
	return logger

