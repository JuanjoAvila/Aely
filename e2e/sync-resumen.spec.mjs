import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test("la sincronización mixta se explica por filas y nunca vuelve al toast gigante", async ({page}) => {
  const links=[{aspsp_name:"CaixaBank",status:"active",accounts:[{uid:"cx"}]}];
  await seedLoggedInDashboard(page,{
    hasBankLink:true,
    bankTx:[],
    settings:{autoPrices:false,theme:"green",expenseBanks:["caixabank"]},
    __cloudRows:{bank_links:links},
    __cloudFns:{"bank-sync":{data:{ok:true,links:[{
      aspsp:"CaixaBank",ok:false,expired:false,
      accounts:[{uid:"cx",ok:false,error:"eb_429",transactions:[]}]
    }]},error:null}}
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button",{name:/Sincronizar bancos/i}).click();

  const report=page.locator(".sync-report");
  await expect(report).toBeVisible({timeout:15_000});
  await expect(report).toContainText("CaixaBank");
  await expect(report).toContainText(/límite temporal|limit/i);
  await expect(report.locator(".sync-report-row")).toHaveCount(1);
  await expect(page.locator(".toast").filter({hasText:"CaixaBank"})).toHaveCount(0);
});
