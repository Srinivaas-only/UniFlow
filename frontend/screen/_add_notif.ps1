$files = Get-ChildItem "c:\Users\isaac\OneDrive\Desktop\UniFlow\frontend\screen\*.html"
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    if ($content -match 'store\.js' -and $content -notmatch 'notifications\.js') {
        $newContent = $content -replace '<script src="../js/store.js"></script>', "<script src=`"../js/store.js`"></script>`n<script src=`"../js/components/notifications.js`"></script>"
        Set-Content $f.FullName $newContent -NoNewline
        Write-Host "Updated: $($f.Name)"
    } else {
        Write-Host "Skipped: $($f.Name)"
    }
}