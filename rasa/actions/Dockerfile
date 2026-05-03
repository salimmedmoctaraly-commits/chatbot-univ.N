FROM rasa/rasa-sdk:3.6.2

WORKDIR /app

USER root

# تثبيت requests
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ ملفات actions
COPY . .

ENV QUESTIONS_FILE=/data/unknown_questions.json

EXPOSE 5055

ENTRYPOINT ["./entrypoint.sh"]
CMD ["start", "--actions", "actions", "--port", "5055"]
