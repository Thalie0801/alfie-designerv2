// Linter de cohérence éditoriale pour carrousels

import { CarouselGlobals, SlideContent, CHAR_LIMITS } from './carouselGlobals.ts';

export interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function lintCarousel(globals: CarouselGlobals, slides: SlideContent[]): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!slides || slides.length === 0) {
    errors.push('R0: Aucune slide fournie');
    return { valid: false, errors, warnings };
  }

  // R1: Promesse unique réutilisée en T3 ou T5
  const promiseKeyword = globals.promise.toLowerCase().slice(0, 15);
  const t3Content = JSON.stringify(slides.find(s => s.type === 'solution') || {}).toLowerCase();
  const t5Content = JSON.stringify(slides.find(s => s.type === 'cta') || {}).toLowerCase();
  
  if (!t3Content.includes(promiseKeyword) && !t5Content.includes(promiseKeyword)) {
    errors.push(`R1: Promesse "${globals.promise}" non reprise en T3 ou T5`);
  }

  // R2: CTA constant sur T1 & T5
  const heroSlide = slides.find(s => s.type === 'hero');
  const ctaSlide = slides.find(s => s.type === 'cta');
  
  if (heroSlide?.cta_primary && ctaSlide?.cta_primary) {
    if (heroSlide.cta_primary.trim() !== ctaSlide.cta_primary.trim()) {
      errors.push(`R2: CTA différent entre Hero ("${heroSlide.cta_primary}") et CTA ("${ctaSlide.cta_primary}")`);
    }
  } else {
    warnings.push('R2: CTA manquant sur Hero ou slide CTA');
  }

  // R3: Terminologie et mots bannis
  slides.forEach((slide, index) => {
    const slideText = JSON.stringify(slide).toLowerCase();
    
    // Vérifier terminologie
    const hasTerminology = globals.terminology.some(term => 
      slideText.includes(term.toLowerCase())
    );
    if (!hasTerminology) {
      warnings.push(`R3: Slide ${index + 1} (${slide.type}) sans terme du glossaire`);
    }

    // Vérifier mots bannis
    globals.banned.forEach(banned => {
      if (slideText.includes(banned.toLowerCase())) {
        errors.push(`R3: Slide ${index + 1} (${slide.type}) contient le mot banni "${banned}"`);
      }
    });
  });

  // R4: Style - pas de !! ou MAJUSCULES intégrales
  slides.forEach((slide, index) => {
    const fields = [slide.title, slide.subtitle, slide.punchline, ...(slide.bullets || [])];
    fields.forEach(field => {
      if (!field) return;
      
      if (field.includes('!!')) {
        warnings.push(`R4: Slide ${index + 1} contient des points d'exclamation multiples`);
      }
      
      // Vérifier MAJUSCULES (exclure acronymes courts)
      const words = field.split(' ');
      words.forEach(word => {
        if (word.length > 4 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
          warnings.push(`R4: Slide ${index + 1} contient du texte en MAJUSCULES: "${word}"`);
        }
      });
    });
  });

  // R5: Unités cohérentes dans KPIs
  const impactSlide = slides.find(s => s.type === 'impact');
  if (impactSlide?.kpis && impactSlide.kpis.length > 0) {
    const hasUnits = impactSlide.kpis.every(kpi => 
      /(%|pts|×)/.test(kpi.delta)
    );
    if (!hasUnits) {
      errors.push('R5: Unités manquantes dans les KPIs (%, pts, ×)');
    }
  }

  // R6: Limites de caractères
  slides.forEach((slide, index) => {
    if (slide.title) {
      checkCharLimit('title', slide.title, CHAR_LIMITS.title, index + 1, errors, warnings);
    }
    if (slide.subtitle) {
      checkCharLimit('subtitle', slide.subtitle, CHAR_LIMITS.subtitle, index + 1, errors, warnings);
    }
    if (slide.punchline) {
      checkCharLimit('punchline', slide.punchline, CHAR_LIMITS.punchline, index + 1, errors, warnings);
    }
    if (slide.bullets) {
      slide.bullets.forEach((bullet, i) => {
        checkCharLimit(`bullet ${i + 1}`, bullet, CHAR_LIMITS.bullet, index + 1, errors, warnings);
      });
    }
    if (slide.cta_primary) {
      checkCharLimit('cta_primary', slide.cta_primary, CHAR_LIMITS.cta, index + 1, errors, warnings);
    }
    if (slide.kpis) {
      slide.kpis.forEach((kpi, i) => {
        checkCharLimit(`kpi ${i + 1} label`, kpi.label, CHAR_LIMITS.kpi_label, index + 1, errors, warnings);
        checkCharLimit(`kpi ${i + 1} delta`, kpi.delta, CHAR_LIMITS.kpi_delta, index + 1, errors, warnings);
      });
    }
    if (slide.note) {
      checkCharLimit('note', slide.note, CHAR_LIMITS.note, index + 1, errors, warnings);
    }
  });

  // R7: Enchaînement logique T2 → T3 → T4
  const problemSlide = slides.find(s => s.type === 'problem');
  const solutionSlide = slides.find(s => s.type === 'solution');
  
  if (problemSlide?.bullets && solutionSlide?.bullets) {
    if (problemSlide.bullets.length > solutionSlide.bullets.length) {
      warnings.push('R7: Plus de problèmes que de solutions (mapping incomplet)');
    }
    
    // Vérifier que T2 n'introduit pas de solution
    problemSlide.bullets.forEach((bullet, i) => {
      const lowerBullet = bullet.toLowerCase();
      if (lowerBullet.includes('solution') || lowerBullet.includes('résoudre') || lowerBullet.includes('grâce à')) {
        warnings.push(`R7: Problème ${i + 1} introduit une solution`);
      }
    });
  }

  // R8: Pas d'hyperboles
  const hyperboles = ['incroyable', 'extraordinaire', 'unique au monde', 'jamais vu', 'absolument'];
  slides.forEach((slide, index) => {
    const slideText = JSON.stringify(slide).toLowerCase();
    hyperboles.forEach(hyp => {
      if (slideText.includes(hyp)) {
        warnings.push(`R8: Slide ${index + 1} contient une hyperbole: "${hyp}"`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function checkCharLimit(
  fieldName: string,
  value: string,
  limit: { min: number; max: number },
  slideIndex: number,
  errors: string[],
  warnings: string[]
) {
  const len = value.length;
  if (len < limit.min) {
    warnings.push(`R6: Slide ${slideIndex} ${fieldName} trop court (${len} < ${limit.min})`);
  }
  if (len > limit.max) {
    errors.push(`R6: Slide ${slideIndex} ${fieldName} trop long (${len} > ${limit.max})`);
  }
}

export function generateCorrectionPrompt(errors: string[], originalPlan: any): string {
  return `Le plan carrousel a échoué la validation. Corrige les erreurs suivantes:

${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Plan original:
${JSON.stringify(originalPlan, null, 2)}

Génère un nouveau plan corrigé en JSON strict, en respectant toutes les règles de validation.`;
}
