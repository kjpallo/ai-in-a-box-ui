# Classroom session lifecycle

Classroom access and Questions & Standards storage are intentionally separate:

- **Expiration** changes an active runtime session to `expired` and blocks student access. It does not delete, archive, or merge student history.
- **Ending** changes a runtime session to `ended` and blocks student access immediately. It does not archive the class report.
- **Reopening** reactivates the same runtime session and join code for a new time window. Existing anonymous hub histories and Tutor state remain attached to their original hubs.
- **Archiving** stores the class report, verifies the CSV, removes the matching raw reporting records, and removes the archived session from active teacher reporting. It does not itself change the runtime access status.
- **Auto-archive** is optional inactivity cleanup controlled by the existing Questions & Standards setting. It is disabled unless the teacher explicitly enables it, and it is not used as session expiration.

The runtime session keeps an internal UUID for server-side reporting and a separate cryptographically random join code for the shared `/join/<code>` student URL. Every student uses that same classroom URL; anonymous hub state remains isolated inside the session.

New sessions default to 60 minutes. Set `STUDENT_SESSION_DEFAULT_MINUTES` to a whole number from 1 through 10080 to change the teacher interface default without coupling it to `PUBLIC_BASE_URL` or `GOOGLE_REDIRECT_URI`.
