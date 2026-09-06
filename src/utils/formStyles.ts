/**
 * Consistent styling constants and classes for text fields and select options.
 * Ensures identical padding, borders, typography, hover, and focus states.
 */

export const FORM_STYLES = {
  // Standard text, date, email, url inputs
  input:
    'w-full h-9.5 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-normal focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors',

  // Input with an icon on the left
  inputWithIcon:
    'w-full h-9.5 pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-normal focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors',

  // Search input with icon
  searchInput:
    'w-full h-9 pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors',

  // Textarea inputs
  textarea:
    'w-full p-3 text-xs sm:text-sm bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors leading-relaxed',

  // Full-width form select with custom arrow
  select:
    'appearance-none w-full h-9.5 pl-3 pr-8 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-colors',

  // Compact / inline select (e.g. navbar or filter toolbar)
  compactSelect:
    'appearance-none h-8 pl-2.5 pr-7 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg shadow-2xs text-slate-700 dark:text-slate-200 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-colors',

  // Task card inline select (for assignee and quick status move)
  cardSelect:
    'appearance-none py-1 pl-2 pr-6 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-colors',
};
