FROM rasa/rasa-sdk:3.6.2

WORKDIR /app

COPY . ./actions/

RUN mkdir -p /app/shared && \
    echo "[]" > /app/shared/unknown_questions.json

ENV QUESTIONS_FILE=/app/shared/unknown_questions.json

EXPOSE 5055

CMD ["start", "--actions", "actions", "--port", "5055"]