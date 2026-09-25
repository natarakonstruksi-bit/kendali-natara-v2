-- Nara System V3.4.14
-- QC is a team-level function (not assigned one QC per project).
-- Existing open/history findings are re-pointed to the Project Manager assigned on the project.
UPDATE app_records AS d
SET data_json = json_set(
      d.data_json,
      '$.picUserId',
      (
        SELECT COALESCE(
          json_extract(p.data_json,'$.pmUserId'),
          json_extract(p.data_json,'$.projectManagerUserId'),
          json_extract(p.data_json,'$.siteManagerUserId'),
          json_extract(p.data_json,'$.smUserId')
        )
        FROM app_records AS p
        WHERE p.collection='projects'
          AND p.id = json_extract(d.data_json,'$.projectId')
        LIMIT 1
      )
    ),
    updated_at = datetime('now')
WHERE d.collection='defects'
  AND EXISTS (
    SELECT 1
    FROM app_records AS p
    WHERE p.collection='projects'
      AND p.id = json_extract(d.data_json,'$.projectId')
      AND COALESCE(
        json_extract(p.data_json,'$.pmUserId'),
        json_extract(p.data_json,'$.projectManagerUserId'),
        json_extract(p.data_json,'$.siteManagerUserId'),
        json_extract(p.data_json,'$.smUserId')
      ) IS NOT NULL
      AND COALESCE(
        json_extract(p.data_json,'$.pmUserId'),
        json_extract(p.data_json,'$.projectManagerUserId'),
        json_extract(p.data_json,'$.siteManagerUserId'),
        json_extract(p.data_json,'$.smUserId')
      ) <> ''
  );
