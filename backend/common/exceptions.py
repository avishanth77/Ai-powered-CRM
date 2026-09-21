from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        errors = {}
        message = "An error occurred while processing your request."

        if isinstance(response.data, dict):
            if 'detail' in response.data:
                message = str(response.data['detail'])
                # If there are other keys
                errors = {k: v for k, v in response.data.items() if k != 'detail'}
                if not errors:
                    errors = {'detail': [message]}
            else:
                errors = response.data
                first_key = next(iter(errors))
                val = errors[first_key]
                if isinstance(val, list) and len(val) > 0:
                    message = f"{first_key}: {val[0]}"
                else:
                    message = f"Validation error on {first_key}"
        elif isinstance(response.data, list):
            errors = {'non_field_errors': response.data}
            if len(response.data) > 0:
                message = str(response.data[0])
        else:
            errors = {'error': [str(response.data)]}
            message = str(response.data)

        custom_data = {
            'success': False,
            'message': message,
            'errors': errors
        }
        response.data = custom_data
        return response

    logger.error("Unhandled Exception: %s", exc, exc_info=True)
    return Response({
        'success': False,
        'message': 'An internal server error occurred.',
        'errors': {'server': [str(exc)]}
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
