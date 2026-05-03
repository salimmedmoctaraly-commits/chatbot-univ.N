FROM rasa/rasa:3.6.20

WORKDIR /app

COPY . .

USER root

RUN mkdir -p /app/shared && \
    echo "[]" > /app/shared/unknown_questions.json

ENV RASA_TELEMETRY_ENABLED=false
ENV RASA_NLU_FALLBACK_THRESHOLD=0.4

RUN rasa train

EXPOSE 5005

CMD ["run", "--enable-api", "--cors", "*", "--port", "5005"]