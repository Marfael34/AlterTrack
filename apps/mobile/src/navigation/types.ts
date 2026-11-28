import { Company } from '../types/company';

/** Écrans de la pile principale (l'écran `Main` contient les onglets). */
export type RootStackParamList = {
  Main: undefined;
  CompanyDetail: { company: Company };
  AddCompany: undefined;
  Settings: undefined;
};
