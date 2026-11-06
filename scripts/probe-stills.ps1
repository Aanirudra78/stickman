Add-Type -AssemblyName System.Drawing

# Pixel probe for the white-theme render.
# Ink = dark pixels (the background, vignette and character drop shadow are
# all light). Text lives above the character's head, so a fixed y split works.
# Overlay furniture (progress bar) lives below y=1870 and is measured as its
# own band so it cannot inflate the character's bounding box.
$dir = "C:\Users\sanir\Music\web\stick man\out\qa"
$frames = @(32, 127, 152, 226, 328, 419, 505, 640)

$inkThreshold = 170
$textBandEnd = 1150
$overlayBandStart = 1870
$safeX = 96
$frameW = 1080
$frameH = 1920
$step = 3
# Points scenes render the character at 1.62x, text scenes at 1.24x.
$pointsFrames = @(226, 328, 419, 505)

$script:failures = 0
$script:checks = 0

function Check($frame, $label, $ok, $detail) {
  $script:checks++
  if (-not $ok) { $script:failures++ }
  $tag = if ($ok) { "PASS" } else { "FAIL" }
  "  $tag  $label  $detail"
}

function Analyze($path) {
  $bmp = [System.Drawing.Bitmap]::FromFile($path)
  $w = $bmp.Width; $h = $bmp.Height
  $bands = @{
    "text"   = @{ minX = 9999; maxX = -1; minY = 9999; maxY = -1; count = 0 }
    "char"   = @{ minX = 9999; maxX = -1; minY = 9999; maxY = -1; count = 0 }
    "bottom" = @{ minX = 9999; maxX = -1; minY = 9999; maxY = -1; count = 0 }
    "all"    = @{ minX = 9999; maxX = -1; minY = 9999; maxY = -1; count = 0 }
  }
  $nearWhite = 0
  $total = 0
  for ($y = 0; $y -lt $h; $y += $step) {
    for ($x = 0; $x -lt $w; $x += $step) {
      $c = $bmp.GetPixel($x, $y)
      $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
      $total++
      if ($lum -gt 240) { $nearWhite++ }
      if ($lum -lt $inkThreshold) {
        $key = if ($y -lt $textBandEnd) {
          "text"
        } elseif ($y -lt $overlayBandStart) {
          "char"
        } else {
          "bottom"
        }
        foreach ($k in @($key, "all")) {
          $b = $bands[$k]
          if ($x -lt $b.minX) { $b.minX = $x }
          if ($x -gt $b.maxX) { $b.maxX = $x }
          if ($y -lt $b.minY) { $b.minY = $y }
          if ($y -gt $b.maxY) { $b.maxY = $y }
          $b.count++
        }
      }
    }
  }
  $corner = $bmp.GetPixel(4, 4)
  $cornerBottom = $bmp.GetPixel(4, $h - 4)
  $bmp.Dispose()
  return @{
    text = $bands["text"]
    char = $bands["char"]
    bottom = $bands["bottom"]
    all = $bands["all"]
    whitePct = 100 * $nearWhite / [math]::Max(1, $total)
    corner = $corner
    cornerBottom = $cornerBottom
  }
}

foreach ($f in $frames) {
  $path = Join-Path $dir "f$f.png"
  "frame $f"
  if (-not (Test-Path $path)) {
    "  FAIL  still missing: $path"
    $script:failures++
    continue
  }

  $b = Analyze $path
  $t = $b["text"]; $c = $b["char"]; $o = $b["bottom"]; $a = $b["all"]
  $cornerLum = 0.299 * $b.corner.R + 0.587 * $b.corner.G + 0.114 * $b.corner.B
  $bottomLum = 0.299 * $b.cornerBottom.R + 0.587 * $b.cornerBottom.G + 0.114 * $b.cornerBottom.B

  "  bg     corner rgb($($b.corner.R),$($b.corner.G),$($b.corner.B))  bottom rgb($($b.cornerBottom.R),$($b.cornerBottom.G),$($b.cornerBottom.B))  near-white $([math]::Round($b.whitePct, 1))%"
  "  text   x=$($t.minX)..$($t.maxX) y=$($t.minY)..$($t.maxY) px=$($t.count)"
  "  char   x=$($c.minX)..$($c.maxX) y=$($c.minY)..$($c.maxY) px=$($c.count)"
  "  bar    x=$($o.minX)..$($o.maxX) y=$($o.minY)..$($o.maxY) px=$($o.count)"
  "  all    x=$($a.minX)..$($a.maxX) y=$($a.minY)..$($a.maxY)"

  # The animated backdrop adds a very light vignette, so the corners are a few
  # lum darker than a flat white fill but still clearly paper.
  Check $f "white background" ($cornerLum -gt 240 -and $bottomLum -gt 225) "corner lum $([math]::Round($cornerLum, 1)) / $([math]::Round($bottomLum, 1))"
  Check $f "brand chip present at the top" ($t.minY -ge 60 -and $t.minY -le 190) "text starts y=$($t.minY)"
  Check $f "text present above character" ($t.count -gt 200 -and $t.maxY -lt $textBandEnd) "text px=$($t.count) ends y=$($t.maxY)"
  Check $f "text inside safe margins" ($t.minX -ge $safeX - 12 -and $t.maxX -le $frameW - $safeX + 12) "x=$($t.minX)..$($t.maxX)"
  Check $f "text does not overlap character" ($t.maxY -lt $c.minY) "text ends $($t.maxY), char starts $($c.minY)"
  Check $f "character fills lower frame" ($c.maxY -ge 1650 -and $c.minY -gt $textBandEnd) "char y=$($c.minY)..$($c.maxY)"
  Check $f "character not clipped" ($c.maxY -le $frameH - 60 -and $c.minX -ge 20 -and $c.maxX -le $frameW - 20) "char x=$($c.minX)..$($c.maxX) y ends $($c.maxY)"
  Check $f "progress bar inside safe margins" ($o.count -gt 0 -and $o.minX -ge $safeX - 12 -and $o.maxX -le $frameW - $safeX + 12 -and $o.minY -ge $overlayBandStart -and $o.maxY -le 1910) "bar x=$($o.minX)..$($o.maxX) y=$($o.minY)..$($o.maxY)"
  Check $f "character clears the progress bar" ($c.maxY -lt $o.minY) "char ends $($c.maxY), bar starts $($o.minY)"
  $minCharHeight = if ($pointsFrames -contains $f) { 500 } else { 380 }
  Check $f "character is a readable size" ($c.maxY - $c.minY -ge $minCharHeight) "height $($c.maxY - $c.minY) (min $minCharHeight)"
  ""
}

"probe: $($script:checks - $script:failures)/$($script:checks) checks passed"
if ($script:failures -gt 0) {
  "$($script:failures) PROBE FAILURE(S)"
  exit 1
}
