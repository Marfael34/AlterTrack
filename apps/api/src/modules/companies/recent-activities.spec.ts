import {
  CARD_RECENT_ACTIVITIES_COUNT,
  attachRecentActivities,
  synthesizeMilestones,
} from './recent-activities';

const company = (
  overrides: Partial<{
    id: string;
    createdAt: Date;
    firstMailSentAt: Date | null;
    followUpSentAt: Date | null;
  }> = {},
) => ({
  id: 'c1',
  createdAt: new Date('2026-11-01T08:00:00Z'),
  firstMailSentAt: null,
  followUpSentAt: null,
  ...overrides,
});

describe('recent-activities', () => {
  it('trie du plus récent au plus ancien et limite au nombre configuré', () => {
    const rows = [
      {
        companyId: 'c1',
        id: 'a',
        type: 'NOTE',
        title: 'A',
        performedAt: new Date('2026-11-10'),
      },
      {
        companyId: 'c1',
        id: 'b',
        type: 'CALL',
        title: 'B',
        performedAt: new Date('2026-11-20'),
      },
      {
        companyId: 'c1',
        id: 'c',
        type: 'NOTE',
        title: 'C',
        performedAt: new Date('2026-11-15'),
      },
    ];

    const [result] = attachRecentActivities([company()], rows);

    expect(result.recentActivities.map((a) => a.id)).toEqual(
      ['b', 'c', 'a'].slice(0, CARD_RECENT_ACTIVITIES_COUNT),
    );
  });

  it("n'attribue les événements qu'à leur entreprise", () => {
    const rows = [
      {
        companyId: 'c2',
        id: 'x',
        type: 'CALL',
        title: 'X',
        performedAt: new Date('2026-11-20'),
      },
    ];

    const [c1, c2] = attachRecentActivities(
      [company(), company({ id: 'c2' })],
      rows,
    );

    expect(c1.recentActivities.map((a) => a.type)).toEqual(['CREATION']);
    expect(c2.recentActivities.map((a) => a.id)).toEqual(['x']);
  });

  it("déduit les jalons d'une fiche sans historique, sans écrire en base", () => {
    const milestones = synthesizeMilestones(
      company({
        firstMailSentAt: new Date('2026-11-05T08:00:00Z'),
        followUpSentAt: new Date('2026-11-12T08:00:00Z'),
      }),
    );

    expect(milestones.map((m) => m.type)).toEqual([
      'FOLLOW_UP_SENT',
      'EMAIL_SENT',
      'CREATION',
    ]);
  });
});
