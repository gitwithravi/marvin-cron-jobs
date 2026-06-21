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
