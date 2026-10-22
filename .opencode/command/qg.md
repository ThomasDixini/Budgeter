---
description: Show the SonarCloud quality summary (gate, ratings, coverage, issues)
---

Show the SonarCloud quality summary for this project. Do NOT guess, modify, or
substitute any command or metric. Run exactly the three commands below, then
format the output exactly as described.

Project key: `ThomasDixini_Budgeter` (organization: `thomasdixini`). The project
is public, so no token is required.

## Step 1 — Measures

```powershell
curl.exe -s "https://sonarcloud.io/api/measures/component?component=ThomasDixini_Budgeter&metricKeys=coverage,uncovered_lines,lines_to_cover,bugs,vulnerabilities,code_smells,duplicated_lines_density,reliability_rating,security_rating,sqale_rating,security_hotspots,ncloc"
```

## Step 2 — Quality gate

```powershell
curl.exe -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=ThomasDixini_Budgeter"
```

## Step 3 — Open issues

```powershell
curl.exe -s "https://sonarcloud.io/api/issues/search?componentKeys=ThomasDixini_Budgeter&resolved=false&ps=100"
```

## Output format

Print a summary with these sections, using the values returned above:

1. **Quality Gate** — `PASSED` when `projectStatus.status` is `OK`, otherwise `FAILED`. The SonarCloud URL: `https://sonarcloud.io/project/overview?id=ThomasDixini_Budgeter`.

2. **Ratings** — map each rating value to its letter (`1.0`→A, `2.0`→B, `3.0`→C, `4.0`→D, `5.0`→E):
   - Reliability (`reliability_rating`), Security (`security_rating`), Maintainability (`sqale_rating`).

3. **Counts** — bugs, vulnerabilities, code smells, security hotspots, duplicated lines density (`%`).

4. **Coverage** — `coverage` %, `lines_to_cover`, `uncovered_lines`, and `ncloc`.

5. **Open issues** — total from Step 3, then one line per issue: `rule | severity | component:line | message`.

6. **Failed conditions** — for each entry in `projectStatus.conditions` whose `status` is not `OK`, print `metricKey (comparator errorThreshold) actual=actualValue`.

If either API call fails or returns no component, report the failure verbatim
instead of inventing values.
