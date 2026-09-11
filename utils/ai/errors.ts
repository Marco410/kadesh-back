export class AiNotConfiguredError extends Error {
  readonly code = "AI_NOT_CONFIGURED";

  constructor(
    message = "Configura tu API key de IA en Perfil de Empresa → Kadesh Urim AI",
  ) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiInsufficientCreditsError extends Error {
  readonly code = "AI_INSUFFICIENT_CREDITS";

  constructor(message = "No te quedan créditos de IA este mes.") {
    super(message);
    this.name = "AiInsufficientCreditsError";
  }
}

export class AiProviderError extends Error {
  readonly code = "AI_PROVIDER_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

export class AiPlatformNotConfiguredError extends Error {
  readonly code = "AI_PLATFORM_NOT_CONFIGURED";

  constructor(
    message = "Kadesh aún no tiene configurada la IA administrada. Prueba con tu propia API key o contacta a soporte.",
  ) {
    super(message);
    this.name = "AiPlatformNotConfiguredError";
  }
}

export class AiRateLimitError extends Error {
  readonly code = "AI_RATE_LIMIT";
  readonly retryAfterSec: number;

  constructor(message: string, retryAfterSec = 60) {
    super(message);
    this.name = "AiRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}
