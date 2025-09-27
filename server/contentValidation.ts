import { profanity } from '@2toad/profanity';

// Lista refinada apenas de palavras verdadeiramente ofensivas em português
const portugueseProfanity = [
  // Palavrões graves (sem termos técnicos ou identidades)
  'porra', 'merda', 'caralho', 'puta', 'putinha', 'vadia', 'safada', 'safado',
  'fdp', 'filho da puta', 'filha da puta', 'desgraça', 'desgraçado', 'desgraçada',
  'otário', 'otária', 'babaca', 'imbecil', 'retardado', 'corno', 'cornudo',
  
  // Insultos homofóbicos ofensivos (removendo identidades legítimas)
  'viado', 'bicha', 'boiola', 'sapatão', 'maricas', 'fresco',
  
  // Termos racistas graves (removidos termos zoológicos comuns)
  'tição',
  
  // Termos sexuais explícitos ofensivos
  'buceta', 'xoxota', 'piroca', 'rola', 'piru',
  'foder', 'fodido', 'punheta', 'puteiro', 'putona',
  
  // Insultos graves
  'escroto', 'escrota', 'desgraçado', 'maldito',
  
  // Insultos moderados comuns (com e sem acentos)
  'burro', 'burra', 'idiota', 'estúpido', 'estupido', 'estúpida', 'estupida', 
  'anta', 'tapado', 'tapada', 'mongolóide', 'mongoloide', 'mongol', 
  'débil', 'debil', 'retardado', 'retardada', 'lixo', 'nojento', 'nojenta',
  'vagabundo', 'vagabunda', 'preguiçoso', 'preguicoso', 'preguiçosa', 'preguicosa', 
  'inútil', 'inutil', 'incompetente',
  
  // Termos de ódio extremo apenas mais graves (removido kkk para evitar falsos positivos com risadas)
  
  // Variações com símbolos/números comuns de evasão
  'p0rra', 'm3rda', 'c4ralho', 'put4', 'f0der'
];

// Função para normalizar texto (remover acentos e espaços extras)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Normalizar caracteres especiais
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    // Reduzir espaçamento e pontuação excessiva para detectar evasões
    .replace(/[\s\-_\.]+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Função para expandir palavras com variantes sem acentos
function expandWordsWithVariants(words: string[]): string[] {
  const expanded = new Set<string>();
  
  words.forEach(word => {
    // Adicionar palavra original
    expanded.add(word);
    // Adicionar variante normalizada (sem acentos)
    const normalized = normalizeText(word);
    if (normalized !== word) {
      expanded.add(normalized);
    }
  });
  
  return Array.from(expanded);
}

// Configurar o filtro com palavras em português (incluindo variantes sem acentos)
const expandedProfanity = expandWordsWithVariants(portugueseProfanity);
profanity.addWords(expandedProfanity);

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

  const cleanText = text.trim();
  const normalizedText = normalizeText(cleanText);
  
  // Verificar se contém palavras ofensivas usando a biblioteca
  if (profanity.exists(cleanText) || profanity.exists(normalizedText)) {
    return {
      isValid: false,
      error: `O campo "${fieldName}" contém conteúdo ofensivo ou inadequado. Por favor, use uma linguagem respeitosa.`
    };
  }

  // Verificar apenas padrões realmente problemáticos (não números normais)
  const problematicPatterns = [
    /(.)\1{7,}/g, // Repetição excessiva de caracteres (8+ vezes - mais tolerante)
  ];

  for (const pattern of problematicPatterns) {
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