{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.udev
    pkgs.xorg.libxcb
    pkgs.libgbm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.cairo
    pkgs.pango
    pkgs.mesa
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.alsa-lib
    pkgs.expat
    pkgs.dbus
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
