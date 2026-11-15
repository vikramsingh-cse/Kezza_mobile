type ApiIssue = {
  loc?: unknown;
  msg?: unknown;
};

/** Convert FastAPI string or validation-list errors to safe UI text. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } } | null
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return null;

        const issue = item as ApiIssue;
        if (typeof issue.msg !== 'string') return null;

        const location = Array.isArray(issue.loc)
          ? issue.loc.filter((part): part is string => typeof part === 'string' && part !== 'body')
          : [];
        const field = location.join('.');
        return field ? `${field}: ${issue.msg}` : issue.msg;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length) return messages.join('\n');
  }

  return fallback;
}
