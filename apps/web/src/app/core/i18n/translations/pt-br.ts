import { PT_BR_FINANCES } from './pt-br-finances';
import { PT_BR_ROUTINES } from './pt-br-routines';
import { PT_BR_SAMPLES } from './pt-br-samples';
import { PT_BR_SENTENCES } from './pt-br-sentences';

/**
 * Brazilian Portuguese, keyed by the English text shown in the app. Add an entry for each new text; one
 * left out shows in English. Keep every `{placeholder}` of the key in the translation.
 */
export const PT_BR: Readonly<Record<string, string>> = {
  ...PT_BR_FINANCES,
  ...PT_BR_ROUTINES,
  ...PT_BR_SAMPLES,
  ...PT_BR_SENTENCES,
  // Shell: header, dock, home
  Profile: 'Perfil',
  'Coming soon': 'Em breve',
  Language: 'Idioma',
  'Module sections': 'Seções do módulo',
  'Switch module': 'Trocar de módulo',
  'Previous module: {name}': 'Módulo anterior: {name}',
  'Next module: {name}': 'Próximo módulo: {name}',
  'Choose a module': 'Escolher um módulo',
  Close: 'Fechar',
  Dismiss: 'Dispensar',
  Demo: 'Demo',
  'Show made-up data': 'Mostrar dados fictícios',
  'Showing made-up data. Click to use yours.':
    'Mostrando dados fictícios. Clique para usar os seus.',
  Modules: 'Módulos',
  'Choose one': 'Escolha um',
  'All modules': 'Todos os módulos',
  'Open module': 'Abrir módulo',
  'Module {position} of {total}': 'Módulo {position} de {total}',
  'Spin left (previous module)': 'Girar à esquerda (módulo anterior)',
  'Spin right (next module)': 'Girar à direita (próximo módulo)',
  'Try again': 'Tentar de novo',
  Backup: 'Backup',
  'Back up or restore your data': 'Fazer backup ou restaurar seus dados',
  'One file with everything: finances, routines, goals and tasks.':
    'Um arquivo com tudo: finanças, rotinas, metas e tarefas.',
  'Download backup': 'Baixar backup',
  'Restore from a backup': 'Restaurar de um backup',
  'Restoring replaces all your data, in every module, with the data in {file}.':
    'Restaurar substitui todos os seus dados, em todos os módulos, pelos dados de {file}.',
  'Replace my data': 'Substituir meus dados',
  'That file is not an Orbit backup. Nothing was changed.':
    'Esse arquivo não é um backup do Orbit. Nada foi alterado.',

  // Modules
  'Routines & Goals': 'Rotinas e Metas',
  Finances: 'Finanças',
  'Organize your daily habits and track the progress of your personal goals.':
    'Organize seus hábitos diários e acompanhe o progresso das suas metas pessoais.',
  'Track income, expenses and the monthly budget in one place.':
    'Acompanhe receitas, despesas e o orçamento do mês em um só lugar.',
  'A new module will show up here.': 'Um novo módulo vai aparecer aqui.',

  // Section tabs
  Today: 'Hoje',
  Routine: 'Rotina',
  'Categories & Goals': 'Categorias e Metas',
  History: 'Histórico',
  Overview: 'Visão geral',
  'Income split': 'Divisão da renda',
  Transactions: 'Transações',
  'Banks & Cards': 'Bancos e Cartões',
  'To pay & receive': 'A pagar e receber',
  Investments: 'Investimentos',
  'Net worth': 'Patrimônio',

  // Page headings
  'My routine': 'Minha rotina',
  Categories: 'Categorias',
  'Decide where each part of what you earn goes. Create, rename and adjust as you like.':
    'Decida para onde vai cada parte do que você ganha. Crie, renomeie e ajuste como quiser.',
  'Each category groups the blocks of your routine and the goals you set for it. Open one to see and create goals.':
    'Cada categoria reúne os blocos da sua rotina e as metas que você definiu para ela. Abra uma para ver e criar metas.',
  'Pick a day to see the blocks you completed and the goals you met.':
    'Escolha um dia para ver os blocos que você concluiu e as metas que cumpriu.',
  'Set your hours and how each part of the day is split.':
    'Defina seus horários e como cada parte do dia é dividida.',
  'What you own, minus what you owe on your cards.':
    'O que você tem, menos o que deve nos cartões.',
  'Where your money stands today.': 'Onde seu dinheiro está hoje.',

  // Load failures
  "Couldn't load your data.": 'Não foi possível carregar seus dados.',
  "Couldn't load your routines.": 'Não foi possível carregar suas rotinas.',
  "Couldn't load the goals.": 'Não foi possível carregar as metas.',
  "Couldn't load this category.": 'Não foi possível carregar esta categoria.',
  "Couldn't load your accounts.": 'Não foi possível carregar suas contas.',
  "Couldn't load your bills.": 'Não foi possível carregar suas contas a pagar.',
  "Couldn't load your income split.": 'Não foi possível carregar a divisão da renda.',
  "Couldn't load your investments.": 'Não foi possível carregar seus investimentos.',
  "Couldn't load your net worth.": 'Não foi possível carregar seu patrimônio.',
  "Couldn't load your overview.": 'Não foi possível carregar sua visão geral.',
  "Couldn't load your transactions.": 'Não foi possível carregar suas transações.',

  // Charts
  'No history yet.': 'Ainda não há histórico.',
  'No proventos in this period.': 'Nenhum provento neste período.',
  'Value over time': 'Evolução do valor',
  'Accumulated return vs CDI': 'Rentabilidade acumulada x CDI',
  'Return per month': 'Rendimento por mês',
  'Proventos received': 'Proventos recebidos',
  'Net worth per month': 'Patrimônio líquido por mês',
  'Current value': 'Valor atual',
  Applied: 'Aplicado',
  'Your investments': 'Seus investimentos',
  Gain: 'Ganho',
  Loss: 'Perda',
};
