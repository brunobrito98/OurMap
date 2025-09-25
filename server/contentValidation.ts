import { profanity } from '@2toad/profanity';

// Lista de palavras ofensivas em português brasileiro
const portugueseProfanity = [
  // Palavras básicas de baixo-calão
  'porra', 'merda', 'caralho', 'puta', 'putinha', 'vadias', 'vadia', 'safada', 'safado',
  'fdp', 'filho da puta', 'filha da puta', 'desgraça', 'desgraçado', 'desgraçada',
  'otário', 'otária', 'babaca', 'imbecil', 'idiota', 'burro', 'burra', 'corno', 'cornudo',
  'viado', 'bicha', 'gay', 'lésbica', 'traveco', 'sapatão', 'boiola',
  
  // Termos pejorativos e ofensivos
  'negro', 'preto', 'macaco', 'símio', 'favelado', 'favelada', 'noia', 'cracudo', 'cracuda',
  'drogado', 'drogada', 'bandido', 'bandida', 'vagabundo', 'vagabunda', 'marginal',
  'terrorista', 'comunista', 'petista', 'bolsominion', 'mortadela', 'coxinha',
  
  // Termos sexuais explícitos
  'buceta', 'xoxota', 'piroca', 'pau', 'rola', 'piça', 'xana', 'pepeca', 'bunda', 'cu',
  'ânus', 'pênis', 'vagina', 'clitóris', 'masturbação', 'punheta', 'siririca',
  'foder', 'trepar', 'transar', 'comer', 'gozar', 'gozada', 'gozo', 'porra',
  
  // Insultos gerais
  'lixo', 'merda', 'bosta', 'nojento', 'nojenta', 'nojo', 'asqueroso', 'asquerosa',
  'escroto', 'escrota', 'podre', 'fedido', 'fedida', 'maluco', 'maluca', 'doido', 'doida',
  
  // Palavras relacionadas a drogas
  'maconha', 'cocaína', 'crack', 'droga', 'drogas', 'traficante', 'dealer', 'biqueira',
  'baseado', 'beck', 'erva', 'pó', 'farinha', 'pedra',
  
  // Variações com números/símbolos comuns
  'p0rra', 'm3rda', 'c4ralho', 'put4', 'foder', 'f0der', '@sshole', 'sh1t', 'f*ck',
  
  // Termos de ódio/extremismo
  'nazista', 'hitler', 'holocausto', 'kkk', 'supremacista', 'fascista',
  'morte', 'matar', 'assassinar', 'suicídio', 'suicidar', 'morrer', 'morra'
];

// Configurar o filtro com palavras em português
profanity.addWords(portugueseProfanity);

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedContent?: any;
}

export interface ValidationConfig {
  checkTitle?: boolean;
  checkDescription?: boolean;
  checkUsername?: boolean;
  checkFirstName?: boolean;
  checkLastName?: boolean;
}

/**
 * Valida se o texto contém palavras ofensivas
 */
export function validateText(text: string, fieldName: string): { isValid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { isValid: true };
  }

  const cleanText = text.trim().toLowerCase();
  
  // Verificar se contém palavras ofensivas
  if (profanity.exists(cleanText)) {
    return {
      isValid: false,
      error: `O campo "${fieldName}" contém conteúdo ofensivo ou inadequado. Por favor, use uma linguagem respeitosa.`
    };
  }

  // Verificar padrões adicionais de conteúdo ofensivo
  const offensivePatterns = [
    /(.)\1{4,}/g, // Repetição excessiva de caracteres (aaaaaaa)
    /[^\w\s]{5,}/g, // Muitos símbolos seguidos (@#$%^&*)
    /\b\w*\d+\w*\b/g // Palavras misturadas com números suspeitos
  ];

  for (const pattern of offensivePatterns) {
    if (pattern.test(cleanText)) {
      return {
        isValid: false,
        error: `O campo "${fieldName}" contém padrões suspeitos. Por favor, use texto normal e respeitoso.`
      };
    }
  }

  return { isValid: true };
}

/**
 * Valida conteúdo de eventos
 */
export function validateEventContent(eventData: {
  title?: string;
  description?: string;
  location?: string;
}): ContentValidationResult {
  const errors: string[] = [];
  
  if (eventData.title) {
    const titleValidation = validateText(eventData.title, 'título do evento');
    if (!titleValidation.isValid && titleValidation.error) {
      errors.push(titleValidation.error);
    }
  }

  if (eventData.description) {
    const descValidation = validateText(eventData.description, 'descrição do evento');
    if (!descValidation.isValid && descValidation.error) {
      errors.push(descValidation.error);
    }
  }

  if (eventData.location) {
    const locationValidation = validateText(eventData.location, 'localização do evento');
    if (!locationValidation.isValid && locationValidation.error) {
      errors.push(locationValidation.error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedContent: errors.length === 0 ? eventData : undefined
  };
}

/**
 * Valida conteúdo de usuários
 */
export function validateUserContent(userData: {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): ContentValidationResult {
  const errors: string[] = [];
  
  if (userData.username) {
    const usernameValidation = validateText(userData.username, 'nome de usuário');
    if (!usernameValidation.isValid && usernameValidation.error) {
      errors.push(usernameValidation.error);
    }
  }

  if (userData.firstName) {
    const firstNameValidation = validateText(userData.firstName, 'primeiro nome');
    if (!firstNameValidation.isValid && firstNameValidation.error) {
      errors.push(firstNameValidation.error);
    }
  }

  if (userData.lastName) {
    const lastNameValidation = validateText(userData.lastName, 'último nome');
    if (!lastNameValidation.isValid && lastNameValidation.error) {
      errors.push(lastNameValidation.error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedContent: errors.length === 0 ? userData : undefined
  };
}

/**
 * Função genérica para validar qualquer conteúdo de texto
 */
export function validateGenericContent(
  content: Record<string, any>, 
  fieldsToValidate: string[]
): ContentValidationResult {
  const errors: string[] = [];
  
  for (const field of fieldsToValidate) {
    if (content[field] && typeof content[field] === 'string') {
      const validation = validateText(content[field], field);
      if (!validation.isValid && validation.error) {
        errors.push(validation.error);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedContent: errors.length === 0 ? content : undefined
  };
}

/**
 * Função para limpar texto (censurar palavras ofensivas)
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  return profanity.censor(text);
}