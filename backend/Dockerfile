FROM public.ecr.aws/lambda/python:3.12

ENV AWS_DEFAULT_REGION=us-east-1

# --- Fix pip timeout & retries (VERY IMPORTANT) ---
ENV PIP_DEFAULT_TIMEOUT=200
ENV PIP_RETRIES=10

# --- Upgrade pip to avoid metadata timeout bugs ---
RUN pip install --upgrade pip

# --- Install dependencies using faster index + longer timeout ---
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --timeout 200 --retries 10 --index-url https://pypi.org/simple

# --- Copy application files ---
COPY lambda_function.py ${LAMBDA_TASK_ROOT}
COPY graph_engine.py ${LAMBDA_TASK_ROOT}

CMD ["lambda_function.lambda_handler"]
