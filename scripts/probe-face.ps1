Add-Type -AssemblyName System.Drawing

# Face readability probe.
#
# Everything is measured in head-local px (so the numbers do not depend on the
# character's scale). Three details keep the numbers honest:
#   - a tight ink threshold (true ink is ~lum 20; the character's drop shadow
#     leaves a wide grey halo inside the hollow head that would otherwise be
#     counted as face ink)
#   - a disc mask inside the head stroke (inner radius 36.5 local px), so the
#     head outline is never measured as "mouth"
#   - the mouth is measured from its centre-column run (height) plus a width
#     scan on that run's mid-row, because the eye bottoms and the neck cap both
#     intrude into a plain rectangular band.
#
# Frames come from `scripts/find-quiet-frames.ts`: only silent, blink-open
# frames with a settled pose. A mid-speech mouth is a cross-fade between the
# smile curve and the open "O", so it would measure as neither shape.
#
# Expected shapes:
#   idle      shallow smiling line (wide, flat)
#   pointing  readable mouth curve
#   surprised tall narrow "O", clear of the chin, wide-open eyes
#   happy     wide smile arc + curved "^ ^" eyes
$dir = "C:\Users\sanir\Music\web\stick man\out\qa"
$cases = @(
  @{ frame = 32;  scale = 1.24; label = "idle" },
  @{ frame = 274; scale = 1.62; label = "pointing" },
  @{ frame = 419; scale = 1.62; label = "surprised" },
  @{ frame = 640; scale = 1.24; label = "happy" }
)

$ink = 120
# Head-local bands (px). Brows sit at y <= -18, eyes -16..+4.
$eyeTop = -16.0
$eyeBottom = 3.0
$eyeHalfWidth = 30.0
# Search window for the mouth: below the eyes, above the chin stroke (36.5).
$mouthSearchTop = 2.0
$mouthSearchBottom = 33.0
$mouthSearchWidth = 32.0
# Stay inside the head circle's inner edge (44 - 15/2 = 36.5).
$faceRadius = 34.0
# The mouth must not touch the chin/neck ink below it.
$minChinGap = 1.0

$script:failures = 0
$script:checks = 0
$script:results = @{}

function Check($pose, $label, $ok, $detail) {
  $script:checks++
  if (-not $ok) { $script:failures++ }
  $tag = if ($ok) { "PASS" } else { "FAIL" }
  "  $tag  $label  $detail"
}

function IsInk($bmp, $x, $y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $bmp.Width -or $y -ge $bmp.Height) { return $false }
  $c = $bmp.GetPixel($x, $y)
  return (0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B) -lt $ink
}

# Ink bounding box inside a head-local band, masked to the face disc.
function FaceBox($bmp, $headX, $headY, $s, $dyTop, $dyBottom, $dxLimit) {
  $minX = 9999; $maxX = -1; $minY = 9999; $maxY = -1; $count = 0
  $x0 = [int][math]::Floor($headX - $dxLimit * $s)
  $x1 = [int][math]::Ceiling($headX + $dxLimit * $s)
  $y0 = [int][math]::Floor($headY + $dyTop * $s)
  $y1 = [int][math]::Ceiling($headY + $dyBottom * $s)
  $r2 = ($faceRadius * $s) * ($faceRadius * $s)

  for ($y = [math]::Max(0, $y0); $y -le [math]::Min($bmp.Height - 1, $y1); $y++) {
    $dy = $y - $headY
    for ($x = [math]::Max(0, $x0); $x -le [math]::Min($bmp.Width - 1, $x1); $x++) {
      $dx = $x - $headX
      if ($dx * $dx + $dy * $dy -gt $r2) { continue }
      if (IsInk $bmp $x $y) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
        $count++
      }
    }
  }
  return @{ minX = $minX; maxX = $maxX; minY = $minY; maxY = $maxY; count = $count }
}

# A row counts as "mouth ink" when the centre column band (dx -4..4 local) is
# mostly dark. Scans the mouth window and returns the run holding the middle.
function MouthSpan($bmp, $headX, $headY, $s) {
  $isRow = @{}
  $y0 = [int][math]::Floor($headY + $mouthSearchTop * $s)
  $y1 = [int][math]::Ceiling($headY + $mouthSearchBottom * $s)
  foreach ($y in $y0..$y1) {
    $hits = 0
    foreach ($dxLocal in -4, -2, 0, 2, 4) {
      if (IsInk $bmp ([int]($headX + $dxLocal * $s)) $y) { $hits++ }
    }
    $isRow[$y] = $hits -ge 3
  }

  $midY = [int][math]::Round($headY + 14 * $s)
  if (-not $isRow[$midY]) {
    # Find the nearest mouth row to the expected mouth centre.
    $best = -1; $bestDist = 9999
    foreach ($y in $y0..$y1) {
      if ($isRow[$y] -and [math]::Abs($y - $midY) -lt $bestDist) {
        $bestDist = [math]::Abs($y - $midY); $best = $y
      }
    }
    if ($best -lt 0) { return $null }
    $midY = $best
  }
  # Grow the run from the row we actually found, not from the guess.
  $top = $midY; $bottom = $midY
  while ($isRow[$top - 1]) { $top-- }
  while ($isRow[$bottom + 1]) { $bottom++ }
  return @{ top = $top; bottom = $bottom; mid = $midY }
}

# Horizontal ink extent on one row, inside the face disc.
function RowSpan($bmp, $headX, $headY, $s, $y) {
  $minX = 9999; $maxX = -1
  $dy = $y - $headY
  $x0 = [int][math]::Floor($headX - $mouthSearchWidth * $s)
  $x1 = [int][math]::Ceiling($headX + $mouthSearchWidth * $s)
  for ($x = [math]::Max(0, $x0); $x -le [math]::Min($bmp.Width - 1, $x1); $x++) {
    $dx = $x - $headX
    if ($dx * $dx + $dy * $dy -gt ($faceRadius * $s) * ($faceRadius * $s)) { continue }
    if (IsInk $bmp $x $y) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
    }
  }
  return @{ minX = $minX; maxX = $maxX }
}

# First ink row below the mouth on the centre column: the neck cap / chin ink.
# Rows immediately under the mouth are skipped because a tall O's own
# antialiasing still answers "ink" there.
function GapBelowMouth($bmp, $headX, $headY, $s, $mouthBottomY) {
  $skip = [int][math]::Ceiling(4 * $s)
  $yStart = [int]($mouthBottomY + $skip)
  $yEnd = [math]::Min($bmp.Height - 1, [int]($headY + 70 * $s))
  for ($y = $yStart; $y -le $yEnd; $y++) {
    $hits = 0
    foreach ($dxLocal in -4, -2, 0, 2, 4) {
      if (IsInk $bmp ([int]($headX + $dxLocal * $s)) $y) { $hits++ }
    }
    if ($hits -ge 2) { return ($y - $mouthBottomY) / $s }
  }
  return 999
}

# Fraction of near-white pixels in a head-local rectangle. Proves the filled
# head actually hides the neck/torso cap under the mouth (the old hollow head
# had a black blob there).
function WhiteFraction($bmp, $headX, $headY, $s, $x0, $x1, $y0, $y1) {
  $clean = 0
  $total = 0
  $px0 = [int][math]::Round($headX + $x0 * $s)
  $px1 = [int][math]::Round($headX + $x1 * $s)
  $py0 = [int][math]::Round($headY + $y0 * $s)
  $py1 = [int][math]::Round($headY + $y1 * $s)
  for ($y = [math]::Max(0, $py0); $y -le [math]::Min($bmp.Height - 1, $py1); $y++) {
    for ($x = [math]::Max(0, $px0); $x -le [math]::Min($bmp.Width - 1, $px1); $x++) {
      $total++
      $c = $bmp.GetPixel($x, $y)
      if ((0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B) -gt 205) { $clean++ }
    }
  }
  if ($total -eq 0) { return 0 }
  return $clean / $total
}

foreach ($case in $cases) {
  $path = Join-Path $dir ("f" + $case.frame + ".png")
  "frame $($case.frame)  $($case.label)  scale $($case.scale)"
  if (-not (Test-Path $path)) {
    "  FAIL  missing $path"
    $script:failures++
    continue
  }

  $bmp = [System.Drawing.Bitmap]::FromFile($path)
  $s = $case.scale

  # Topmost ink below the text band = crown of the head (hands never rise above
  # the head in the V poses, and the point/think/talk arms stay below it).
  $topY = -1; $topMinX = 9999; $topMaxX = -1
  for ($y = 1150; $y -lt $bmp.Height -and $topY -lt 0; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if (IsInk $bmp $x $y) {
        if ($x -lt $topMinX) { $topMinX = $x }
        if ($x -gt $topMaxX) { $topMaxX = $x }
      }
    }
    if ($topMaxX -ge 0) { $topY = $y }
  }

  if ($topY -lt 0) {
    "  FAIL  no head ink found"
    $bmp.Dispose()
    $script:failures++
    continue
  }

  # Head circle: radius 44 + stroke 15/2 = 51.5 local px to the outer edge.
  $headX = ($topMinX + $topMaxX) / 2
  $headY = $topY + 51.5 * $s

  $eyes = FaceBox $bmp $headX $headY $s $eyeTop $eyeBottom $eyeHalfWidth
  $mouth = MouthSpan $bmp $headX $headY $s

  if ($null -eq $mouth -or $eyes.count -eq 0) {
    "  FAIL  face features not found (mouth=$($null -ne $mouth) eyes px=$($eyes.count))"
    $bmp.Dispose()
    $script:failures++
    continue
  }

  $row = RowSpan $bmp $headX $headY $s $mouth.mid
  $mouthW = ($row.maxX - $row.minX + 1) / $s
  $mouthH = ($mouth.bottom - $mouth.top + 1) / $s
  $mouthTopLocal = ($mouth.top - $headY) / $s
  $mouthBottomLocal = ($mouth.bottom - $headY) / $s
  $eyeH = ($eyes.maxY - $eyes.minY + 1) / $s
  $aspect = $mouthW / [math]::Max(0.001, $mouthH)
  $gap = GapBelowMouth $bmp $headX $headY $s $mouth.bottom
  $chinClean = WhiteFraction $bmp $headX $headY $s (-7) 7 31 35

  $bmp.Dispose()

  "  head   ($([math]::Round($headX, 1)), $([math]::Round($headY, 1)))"
  "  mouth  w=$([math]::Round($mouthW, 1)) h=$([math]::Round($mouthH, 1)) local  w/h=$([math]::Round($aspect, 2))  y=$([math]::Round($mouthTopLocal, 1))..$([math]::Round($mouthBottomLocal, 1))"
  "  eyes   h=$([math]::Round($eyeH, 1)) local  px=$($eyes.count)"
  "  gap    mouth -> chin/neck $([math]::Round($gap, 1)) local"
  "  chin   white below the mouth $([math]::Round($chinClean * 100, 1))%"

  $script:results[$case.label] = @{
    mouthW = $mouthW; mouthH = $mouthH; aspect = $aspect; eyeH = $eyeH; gap = $gap
  }

  switch ($case.label) {
    "idle" {
      Check $case.label "smiling line is wide and flat" ($aspect -gt 1.8) "w/h=$([math]::Round($aspect, 2))"
      Check $case.label "mouth clears the chin" ($gap -ge $minChinGap) "gap $([math]::Round($gap, 1)) local"
    }
    "pointing" {
      Check $case.label "mouth is a readable curve" ($aspect -gt 1.6) "w/h=$([math]::Round($aspect, 2))"
      Check $case.label "mouth clears the chin" ($gap -ge $minChinGap) "gap $([math]::Round($gap, 1)) local"
    }
    "surprised" {
      Check $case.label "surprised mouth is a tall O" ($mouthH -gt $mouthW * 1.4) "w=$([math]::Round($mouthW, 1)) h=$([math]::Round($mouthH, 1))"
      Check $case.label "surprised O clears the chin" ($gap -ge $minChinGap) "gap $([math]::Round($gap, 1)) local"
      Check $case.label "surprised eyes are wide open" ($eyeH -ge 17) "eye height $([math]::Round($eyeH, 1)) local"
      Check $case.label "chin is clean under the O" ($chinClean -ge 0.95) "white $([math]::Round($chinClean * 100, 1))% in local 31..35"
    }
    "happy" {
      Check $case.label "happy mouth is a wide smile arc" ($aspect -gt 2.5) "w/h=$([math]::Round($aspect, 2))"
      Check $case.label "happy eyes are curved arcs" ($eyeH -ge 10 -and $eyeH -le 18) "eye height $([math]::Round($eyeH, 1)) local"
    }
  }
  ""
}

$idle = $script:results["idle"]
$surprised = $script:results["surprised"]
$happy = $script:results["happy"]

if ($idle -and $surprised -and $happy) {
  Check "shapes" "surprised O is narrower than the happy smile" ($happy.mouthW -gt $surprised.mouthW * 2) "happy w $([math]::Round($happy.mouthW, 1)) vs surprised w $([math]::Round($surprised.mouthW, 1))"
  Check "shapes" "surprised O is taller than the happy smile" ($surprised.mouthH -gt $happy.mouthH * 1.8) "surprised h $([math]::Round($surprised.mouthH, 1)) vs happy h $([math]::Round($happy.mouthH, 1))"
  Check "shapes" "surprised eyes are wider than idle eyes" ($surprised.eyeH -gt $idle.eyeH * 1.2) "surprised $([math]::Round($surprised.eyeH, 1)) vs idle $([math]::Round($idle.eyeH, 1)) local"
}

"face probe: $($script:checks - $script:failures)/$($script:checks) checks passed"
if ($script:failures -gt 0) {
  "$($script:failures) FACE PROBE FAILURE(S)"
  exit 1
}
