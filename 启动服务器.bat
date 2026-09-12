@echo off
chcp 65001 >nul
echo 正在启动本地服务器，请不要关闭本窗口...
echo.
echo 浏览器访问：
echo   http://localhost:8765/            （作业导航首页）
echo   http://localhost:8765/dashboard/  （案例复现）
echo.
start "" "http://localhost:8765/"
py -m http.server 8765
