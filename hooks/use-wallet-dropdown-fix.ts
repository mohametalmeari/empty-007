"use client";

import { useEffect } from "react";

export function useWalletDropdownFix() {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      const dropdowns = document.querySelectorAll(".wallet-adapter-dropdown");

      dropdowns.forEach((dropdown) => {
        const dropdownList = dropdown.querySelector(
          ".wallet-adapter-dropdown-list"
        );

        if (
          dropdownList &&
          (dropdownList as HTMLElement).style.display === "flex"
        ) {
          if (!dropdown.contains(target)) {
            (dropdownList as HTMLElement).style.display = "none";
            dropdown.classList.remove("wallet-adapter-dropdown-open");
          }
        }
      });
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const dropdownLists = document.querySelectorAll(
          ".wallet-adapter-dropdown-list"
        );
        dropdownLists.forEach((list) => {
          (list as HTMLElement).style.display = "none";
          list.parentElement?.classList.remove("wallet-adapter-dropdown-open");
        });
      }
    };

    const observeDropdowns = () => {
      const dropdowns = document.querySelectorAll(".wallet-adapter-dropdown");

      dropdowns.forEach((dropdown) => {
        const button = dropdown.querySelector(".wallet-adapter-button");
        const dropdownList = dropdown.querySelector(
          ".wallet-adapter-dropdown-list"
        );

        if (
          button &&
          dropdownList &&
          !button.hasAttribute("data-dropdown-fixed")
        ) {
          button.setAttribute("data-dropdown-fixed", "true");

          button.addEventListener("click", (e) => {
            e.stopPropagation();

            const isOpen =
              (dropdownList as HTMLElement).style.display === "flex";

            document
              .querySelectorAll(".wallet-adapter-dropdown-list")
              .forEach((list) => {
                if (list !== dropdownList) {
                  (list as HTMLElement).style.display = "none";
                  list.parentElement?.classList.remove(
                    "wallet-adapter-dropdown-open"
                  );
                }
              });

            if (isOpen) {
              (dropdownList as HTMLElement).style.display = "none";
              dropdown.classList.remove("wallet-adapter-dropdown-open");
            } else {
              (dropdownList as HTMLElement).style.display = "flex";
              dropdown.classList.add("wallet-adapter-dropdown-open");
            }
          });
        }
      });
    };

    observeDropdowns();

    const observer = new MutationObserver(() => {
      observeDropdowns();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
      observer.disconnect();
    };
  }, []);
}
