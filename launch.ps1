$scriptsDir = "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts"
$localBin = "$env:USERPROFILE\.local\bin"
$env:Path = "$scriptsDir;$localBin;$env:PATH"

balatrobot serve --fast --love-path "E:\SteamLibrary\steamapps\common\Balatro\Balatro.exe" --lovely-path "E:\SteamLibrary\steamapps\common\Balatro\version.dll" --no-shaders --logs-path "D:\code\balatro-mod\logs"
