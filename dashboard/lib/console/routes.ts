export const consoleBasePath = "/console";

export const consoleRoutes = {
  overview: consoleBasePath,
  approvals: `${consoleBasePath}/approvals`,
  beszel: `${consoleBasePath}/beszel`,
  teamStatus: `${consoleBasePath}/team-status`,
  support: `${consoleBasePath}/support`,
  reports: `${consoleBasePath}/reports`,
  status: `${consoleBasePath}/status`,
  todos: `${consoleBasePath}/todos`,
  emailCaptures: `${consoleBasePath}/email-captures`,
  invoices: `${consoleBasePath}/invoices`
} as const;

export const legacyDashboardRedirects = {
  "/dashboard": consoleRoutes.overview,
  "/dashboard/approvals": consoleRoutes.approvals,
  "/dashboard/beszel": consoleRoutes.beszel,
  "/dashboard/team-status": consoleRoutes.teamStatus,
  "/dashboard/support": consoleRoutes.support,
  "/dashboard/reports": consoleRoutes.reports,
  "/dashboard/status": consoleRoutes.status,
  "/dashboard/todos": consoleRoutes.todos,
  "/dashboard/email-captures": consoleRoutes.emailCaptures,
  "/dashboard/invoices": consoleRoutes.invoices
} as const;
