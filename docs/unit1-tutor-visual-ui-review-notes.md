# Unit 1 Tutor Visual UI Review Notes

## Scope

This note documents future review needs for the Unit 1 Formula Tutor visuals:

* `metric_stair_step`
* `picket_fence`

This is not a UI rewrite. The current implementation should remain in place until a focused UI/UX pass is planned.

## Current status

* The visuals are functional.
* Visual metadata and rendering are covered by tests.
* Student-facing clarity still needs browser/manual review.

## Metric stair-step review questions

* Is the terminology of Move up / Move down clear to students?
* Is the decimal direction clear when the decimal moves left or right?
* Are the start unit and target unit easy to identify?
* Is the current marker clear enough as it moves across the stair steps?
* Does the visual layout work well on mobile and narrow screens?
* Should the student-friendly wording be "Move decimal left/right" or "Move toward smaller/larger unit"?

## Picket fence review questions

* Are the fraction cells readable at a glance?
* Are canceled units visible enough?
* Is the final unit easy to identify?
* Is the multiplication/division flow clear?
* Does "Show next step" reveal useful information, or does it only highlight items that are already visible?
* Does the visual layout work well on mobile and narrow screens?
* Are conversion factors visually connected to the explanation?

## Future acceptance criteria

* Student can tell what value they start with.
* Student can tell what unit they need.
* Student can tell what operation or decimal move happens.
* Student can identify what cancels.
* Student can see the final answer without hunting.
* Visual works on small screens.
