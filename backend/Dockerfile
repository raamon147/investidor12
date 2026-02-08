# Usa uma imagem leve do Python 3.9
FROM python:3.9-slim

# Define a pasta de trabalho
WORKDIR /app

# Instala dependências do sistema necessárias para compilar algumas libs python
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copia os requisitos e instala
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código fonte
COPY main.py .

# Expõe a porta 8000
EXPOSE 8000

# Comando para rodar a API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]