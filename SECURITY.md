# Security policy

This is a hackathon prototype. It uses **synthetic data only**. Do not submit real policyholder data.

## Reporting a vulnerability
Open a private security advisory on the repository, or contact the maintainers directly. Please do not open a public issue for security problems.

## Design commitments
- Roles are enforced on the server from the database, never from client claims.
- Evidence is stored in a private bucket and served by short-lived signed URLs.
- Firebase App Check protects Firebase AI Logic (and optionally the Node API).
- Raw claim narratives and images are never written to application logs or AI telemetry.
- The AI never approves, rejects, prices or settles a claim.
