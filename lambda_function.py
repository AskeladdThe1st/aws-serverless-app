# LAMBDA FUNCTION CODE - Copy/paste into AWS Lambda console
# Runtime: Python 3.12
# Architecture: x86_64
# Memory: 512 MB (recommended)
# Timeout: 30 seconds (recommended)

import json
import base64
import boto3
import os
from openai import OpenAI

def lambda_handler(event, context):
    """
    Main Lambda handler for calculus problem solving.
    Expects: { "text": "problem text", "image": "base64_encoded_image" }
    Returns: { "expression": "latex", "result": "answer", "steps": "explanation" }
    """
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # Handle OPTIONS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        text = body.get('text', '')
        image_base64 = body.get('image')
        
        # Get OpenAI API key from Secrets Manager
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(
            SecretId='calculus-agent/openai-key'
        )
        openai_api_key = json.loads(secret_response['SecretString'])['OPENAI_API_KEY']
        
        # Initialize OpenAI client
        client = OpenAI(api_key=openai_api_key)
        
        # Step 1: Extract LaTeX/SymPy expression using GPT-4 Vision
        expression = extract_expression(client, text, image_base64)
        
        # Step 2: Solve using SymPy
        result = solve_with_sympy(expression)
        
        # Step 3: Get step-by-step explanation
        steps = get_explanation(client, expression, result)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'expression': expression,
                'result': result,
                'steps': steps
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': str(e)
            })
        }


def extract_expression(client, text, image_base64):
    """Extract mathematical expression using GPT-4 Vision."""
    messages = [
        {
            "role": "system",
            "content": "You are a calculus expert. Extract the mathematical expression from the input and convert it to LaTeX format suitable for SymPy. Only return the LaTeX expression, nothing else."
        }
    ]
    
    if image_base64:
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"Extract the calculus problem from this image. Additional context: {text}"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                }
            ]
        })
    else:
        messages.append({
            "role": "user",
            "content": f"Extract and format this calculus problem: {text}"
        })
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=500
    )
    
    return response.choices[0].message.content.strip()


def solve_with_sympy(expression):
    """Solve the expression using SymPy."""
    try:
        import sympy as sp
        
        # Parse the expression
        # This is a simplified version - enhance based on problem types
        x = sp.Symbol('x')
        expr = sp.sympify(expression)
        
        # Try to solve/simplify
        if 'integrate' in expression.lower() or '\\int' in expression:
            result = sp.integrate(expr, x)
        elif 'differentiate' in expression.lower() or 'derivative' in expression.lower() or '\\frac{d' in expression:
            result = sp.diff(expr, x)
        elif 'limit' in expression.lower():
            result = sp.limit(expr, x, 0)  # Default limit point
        else:
            result = sp.simplify(expr)
        
        return sp.latex(result)
        
    except Exception as e:
        print(f"SymPy error: {str(e)}")
        return "Unable to compute result"


def get_explanation(client, expression, result):
    """Get step-by-step explanation using GPT-4."""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a calculus tutor. Provide clear, step-by-step explanations for calculus problems. Use LaTeX notation enclosed in $ for inline math and $$ for display math."
            },
            {
                "role": "user",
                "content": f"Explain how to solve this calculus problem step by step:\n\nProblem: {expression}\nResult: {result}\n\nProvide a detailed step-by-step solution with LaTeX formatting."
            }
        ],
        max_tokens=1000
    )
    
    return response.choices[0].message.content.strip()
