import { buildStandardCvFileName } from './app-config.service';

describe('buildStandardCvFileName (Uniformisation nom_prenom_CV.pdf)', () => {
  it('should format standard "Prénom Nom" into nom_prenom_CV.pdf', () => {
    expect(buildStandardCvFileName('Raphael Martinez')).toBe(
      'martinez_raphael_CV.pdf',
    );
  });

  it('should format "NOM Prénom" (all-caps last name) into nom_prenom_CV.pdf', () => {
    expect(buildStandardCvFileName('MARTINEZ Raphael')).toBe(
      'martinez_raphael_CV.pdf',
    );
  });

  it('should strip accents and special characters cleanly', () => {
    expect(buildStandardCvFileName('Raphaël Martínez')).toBe(
      'martinez_raphael_CV.pdf',
    );
    expect(buildStandardCvFileName('Éléonore Dupont-Moretti')).toBe(
      'dupont_moretti_eleonore_CV.pdf',
    );
  });

  it('should handle single name or single word', () => {
    expect(buildStandardCvFileName('Martinez')).toBe('martinez_CV.pdf');
  });

  it('should fallback to candidat_CV.pdf when name is empty or null', () => {
    expect(buildStandardCvFileName(null)).toBe('candidat_CV.pdf');
    expect(buildStandardCvFileName('')).toBe('candidat_CV.pdf');
    expect(buildStandardCvFileName('   ')).toBe('candidat_CV.pdf');
  });
});
