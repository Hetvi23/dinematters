"""Logging configuration"""

import logging
import sys
from pythonjsonlogger import jsonlogger

# Handle imports - work as both module and script
import sys
import os

# Add parent directory to path for absolute imports
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
if _parent_dir not in sys.path:
	sys.path.insert(0, _parent_dir)

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

