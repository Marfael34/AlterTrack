# AlterTrack - Ouvre Metro (WSL) et l'API (Docker Desktop) au téléphone sur le Wi-Fi.
#
# Lancé automatiquement (fenêtre UAC) par `npm run dev` quand c'est nécessaire :
# au premier lancement, puis quand l'IP de WSL a changé (redémarrage).
#
# - Metro (8081) tourne dans WSL, en réseau NAT : Windows redirige le port vers
#   l'IP de WSL. L'API (3000) est publiée par Docker Desktop directement sur
#   Windows : pas de redirection (le port est déjà occupé par Docker).
# - Pare-feu : 3000 et 8081 autorisés uniquement depuis le réseau local.
#
# Pour tout retirer (PowerShell administrateur) :  .\dev-local-windows.ps1 -Remove

param(
  [string]$WslIp,
  [switch]$Remove
)

$MetroPort = 8081
$FirewallPorts = @(3000, 8081)
$RuleName = 'AlterTrack dev local (API 3000, Metro 8081)'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  throw 'Ce script doit être lancé dans PowerShell en tant qu''administrateur.'
}

# Anciennes redirections (3000 entrait en conflit avec Docker) et règle : on
# repart de zéro. Absentes au premier lancement : les messages sont ignorés.
foreach ($port in @(3000, $MetroPort)) {
  netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$port | Out-Null
}
Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

if ($Remove) {
  Write-Host 'Redirection et règle de pare-feu AlterTrack supprimées.'
  exit 0
}

if (-not $WslIp) {
  $WslIp = (wsl.exe hostname -I).Trim().Split(' ')[0]
}
if (-not $WslIp) {
  throw 'IP de WSL introuvable : WSL est-il démarré ?'
}

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$MetroPort connectaddress=$WslIp connectport=$MetroPort | Out-Null

# Le Wi-Fi peut être en profil « Public » : on autorise tous les profils, mais
# seulement depuis le sous-réseau local (le téléphone sur la même box).
New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Protocol TCP `
  -LocalPort $FirewallPorts -Action Allow -Profile Any -RemoteAddress LocalSubnet -ErrorAction Stop | Out-Null

Write-Host "Metro ($MetroPort) redirigé vers WSL ($WslIp), pare-feu ouvert au réseau local."
