The document must record:
- The original commit and repository architecture.
- All existing applications and backend responsibilities.
- The 31 existing database migrations.
- Existing CI checks and the successful baseline CI run.
- Existing features that must be preserved.
- Phase 0 acceptance criteria and the boundary preventing Phase 1 from starting early.
Phase 0 acceptance and merge policy

Phase 0 establishes the repository baseline before Phase 1 development. The baseline documentation is maintained in version control. Changes must preserve existing functionality, pass the required CI checks, and comply with the repository's branch protection rules. Phase 1 begins only after the Phase 0 acceptance criteria have been verified.

Our preservation rule remains absolute: no deleting existing functionality; changes must extend or update the project compatibly.
