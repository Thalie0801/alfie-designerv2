/**
 * Utilitaires de validation centralisés
 * Pour améliorer la cohérence et la sécurité de la plateforme
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valide un fichier image
 */
export function validateImageFile(file: File): ValidationResult {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '❌ Image trop volumineuse (max 10MB)'
    };
  }
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: '❌ Format non supporté. Utilisez JPG, PNG ou WebP.'
    };
  }
  
  return { valid: true };
}

/**
 * Valide un fichier vidéo
 */
export function validateVideoFile(file: File): ValidationResult {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '❌ Vidéo trop volumineuse (max 100MB)'
    };
  }
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: '❌ Format non supporté. Utilisez MP4, WebM ou MOV.'
    };
  }
  
  return { valid: true };
}

/**
 * Valide les paramètres de génération de carrousel
 */
export function validateCarouselParams(numCarousels: number, numSlides: number): ValidationResult {
  if (numCarousels < 1 || numCarousels > 20) {
    return {
      valid: false,
      error: '❌ Nombre de carrousels invalide (1-20)'
    };
  }
  
  if (numSlides < 1 || numSlides > 10) {
    return {
      valid: false,
      error: '❌ Nombre de slides invalide (1-10)'
    };
  }
  
  return { valid: true };
}

/**
 * Valide un prompt de génération
 */
export function validatePrompt(prompt: string, minLength = 10, maxLength = 2000): ValidationResult {
  const trimmed = prompt.trim();
  
  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `❌ Prompt trop court (min ${minLength} caractères)`
    };
  }
  
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `❌ Prompt trop long (max ${maxLength} caractères)`
    };
  }
  
  return { valid: true };
}

/**
 * Valide un format d'aspect ratio
 */
export function validateAspectRatio(ratio: string): ValidationResult {
  const validRatios = ['1:1', '4:5', '9:16', '16:9'];
  
  if (!validRatios.includes(ratio)) {
    return {
      valid: false,
      error: `❌ Format invalide. Utilisez: ${validRatios.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize user input pour éviter les injections
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Valide une URL
 */
export function validateUrl(url: string): ValidationResult {
  try {
    const parsed = new URL(url);
    const validProtocols = ['http:', 'https:'];
    
    if (!validProtocols.includes(parsed.protocol)) {
      return {
        valid: false,
        error: '❌ Protocole invalide. Utilisez HTTP ou HTTPS.'
      };
    }
    
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: '❌ URL invalide'
    };
  }
}

/**
 * Formate un message d'erreur de manière user-friendly
 */
export function formatErrorMessage(error: any): string {
  if (!error) return '❌ Une erreur inconnue est survenue';
  
  const message = error.message || error.toString();
  
  // Mapping des erreurs communes
  const errorMap: Record<string, string> = {
    'quota': '🚨 Quota insuffisant. Veuillez upgrader votre plan.',
    'auth': '🔒 Erreur d\'authentification. Veuillez vous reconnecter.',
    'network': '🌐 Erreur réseau. Vérifiez votre connexion.',
    'timeout': '⏱️ Délai d\'attente dépassé. Veuillez réessayer.',
    'permission': '🚫 Permissions insuffisantes.',
    'not_found': '🔍 Ressource introuvable.',
    'invalid': '❌ Données invalides.',
    'server': '🔧 Erreur serveur. Veuillez réessayer plus tard.'
  };
  
  for (const [key, friendlyMessage] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key)) {
      return friendlyMessage;
    }
  }
  
  return `❌ ${message}`;
}

/**
 * Vérifie si une valeur est un nombre valide
 */
export function isValidNumber(value: any, min?: number, max?: number): ValidationResult {
  const num = Number(value);
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: '❌ Valeur numérique invalide'
    };
  }
  
  if (min !== undefined && num < min) {
    return {
      valid: false,
      error: `❌ Valeur trop petite (min: ${min})`
    };
  }
  
  if (max !== undefined && num > max) {
    return {
      valid: false,
      error: `❌ Valeur trop grande (max: ${max})`
    };
  }
  
  return { valid: true };
}
