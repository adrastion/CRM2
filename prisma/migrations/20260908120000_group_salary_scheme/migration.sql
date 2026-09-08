-- Group-level salary scheme/rate (copied from primary trainer where missing)
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "salaryScheme" TEXT;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "salaryRate" DECIMAL(65,30);

UPDATE "groups" g
SET
  "salaryScheme" = COALESCE(
    NULLIF(g."salaryScheme", ''),
    CASE
      WHEN t."salaryScheme" IN ('per_training_person', 'fixed_per_student_month', 'percent_month')
        THEN t."salaryScheme"
      WHEN t."salaryType" IN ('percentage', 'individual', 'percent_month') THEN 'percent_month'
      WHEN t."salaryType" IN ('per_student', 'per_training', 'per_training_person') THEN 'per_training_person'
      WHEN t."salaryType" = 'fixed_per_student_month' THEN 'fixed_per_student_month'
      WHEN t."salaryScheme" = 'fixed_monthly' OR t."salaryType" = 'fixed' OR t."salaryType" = 'fixed_monthly'
        THEN NULL
      ELSE 'per_training_person'
    END
  ),
  "salaryRate" = COALESCE(
    g."salaryRate",
    t."salaryRate",
    t."salaryAmount",
    t."salaryPercentage"
  )
FROM "trainers" t
WHERE g."trainerId" = t."id"
  AND (g."salaryScheme" IS NULL OR g."salaryRate" IS NULL);
