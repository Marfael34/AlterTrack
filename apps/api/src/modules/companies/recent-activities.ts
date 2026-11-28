/**
 * Nombre d'événements d'historique renvoyés pour chaque carte de la liste
 * des entreprises (cahier des charges, EF-2.1 : modifiable entre 1 et 3).
 */
export const CARD_RECENT_ACTIVITIES_COUNT = 2;

export interface RecentActivity {
  id: string;
  type: string;
  title: string;
  performedAt: Date;
}

export interface RecentActivityRow extends RecentActivity {
  companyId: string;
}

interface CompanyMilestones {
  id: string;
  createdAt: Date;
  firstMailSentAt: Date | null;
  followUpSentAt: Date | null;
}

/**
 * Jalons déduits des dates de la fiche, pour les entreprises antérieures à
 * l'historique (mêmes libellés que la synthèse de `getActivities`). Ils ne
 * sont pas écrits en base : une lecture de liste ne doit rien modifier.
 */
export function synthesizeMilestones(
  company: CompanyMilestones,
): RecentActivity[] {
  const milestones: RecentActivity[] = [
    {
      id: `${company.id}-creation`,
      type: 'CREATION',
      title: 'Création de la fiche',
      performedAt: company.createdAt,
    },
  ];
  if (company.firstMailSentAt) {
    milestones.push({
      id: `${company.id}-email-sent`,
      type: 'EMAIL_SENT',
      title: 'Candidature envoyée',
      performedAt: company.firstMailSentAt,
    });
  }
  if (company.followUpSentAt) {
    milestones.push({
      id: `${company.id}-follow-up-sent`,
      type: 'FOLLOW_UP_SENT',
      title: 'Relance effectuée',
      performedAt: company.followUpSentAt,
    });
  }
  return milestones.sort(
    (a, b) => b.performedAt.getTime() - a.performedAt.getTime(),
  );
}

/**
 * Associe à chaque entreprise ses derniers événements, du plus récent au plus
 * ancien. `rows` provient d'une requête unique déjà limitée par entreprise.
 */
export function attachRecentActivities<T extends CompanyMilestones>(
  companies: T[],
  rows: RecentActivityRow[],
  limit: number = CARD_RECENT_ACTIVITIES_COUNT,
): Array<T & { recentActivities: RecentActivity[] }> {
  const byCompany = new Map<string, RecentActivity[]>();
  for (const row of rows) {
    const list = byCompany.get(row.companyId) ?? [];
    list.push({
      id: row.id,
      type: row.type,
      title: row.title,
      performedAt: row.performedAt,
    });
    byCompany.set(row.companyId, list);
  }

  return companies.map((company) => {
    const stored = byCompany.get(company.id);
    const activities =
      stored && stored.length > 0
        ? [...stored].sort(
            (a, b) => b.performedAt.getTime() - a.performedAt.getTime(),
          )
        : synthesizeMilestones(company);
    return { ...company, recentActivities: activities.slice(0, limit) };
  });
}
