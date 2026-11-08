/**
 * AI Guru distribution postinstall.
 *
 * The student-facing AI Guru runtime does not require the OpenMAIC build chain.
 * The upstream OpenMAIC workspace packages are retained only for legacy routes.
 * Do not run their package-level builds here: stripped distributions may not
 * contain the upstream optional build packages/configuration.
 */
console.log('[AI Guru] postinstall: native AI Guru runtime selected; legacy OpenMAIC build chain skipped.');
