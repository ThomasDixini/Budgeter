/**
 * Brazilian Portuguese for the names the API starts a new database with (accounts, routine categories,
 * routines, blocks and tasks). They come out of the database in English, so templates run them through
 * the translator; a name the person typed is not in here and is shown exactly as typed.
 */
export const PT_BR_SAMPLES: Readonly<Record<string, string>> = {
  // Accounts
  'Checking account': 'Conta corrente',
  // Routine categories
  Study: 'Estudo',
  Networking: 'Networking',
  Reading: 'Leitura',
  Exercise: 'Exercício',
  // Routines and their blocks
  Weekdays: 'Dias úteis',
  Weekend: 'Fim de semana',
  Work: 'Trabalho',
  Lunch: 'Almoço',
  'C# study': 'Estudo de C#',
  Workout: 'Treino',
  // Tasks
  'Reply to pending emails': 'Responder e-mails pendentes',
  'Review class notes': 'Revisar anotações de aula',
  'Do the LINQ exercises': 'Fazer os exercícios de LINQ',
  'Message 2 contacts': 'Mandar mensagem para 2 contatos',
  'Read 20 pages': 'Ler 20 páginas',
};
