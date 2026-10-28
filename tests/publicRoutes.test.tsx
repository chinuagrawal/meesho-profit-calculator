// @vitest-environment jsdom
import React from "react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen } from "@testing-library/react";
import { MemoryRouter,useLocation } from "react-router-dom";
const state=vi.hoisted(()=>({user:null as null|{uid:string}}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>({user:state.user,initializing:false,error:null})}));
vi.mock("@/pages/LoginPage",()=>({default:()=> <h1>Phone login</h1>}));
vi.mock("@/components/AccountDashboard",()=>({default:()=> <h1>Account dashboard</h1>}));
import { AccountApp } from "@/components/AccountApp";
function Location(){const location=useLocation();return <span data-testid="location">{location.pathname+location.search}</span>;}
beforeEach(()=>{state.user=null;window.scrollTo=vi.fn();});afterEach(()=>cleanup());
describe("public landing and account routes",()=>{
  it("opens the landing page first and connects its CTA to login",async()=>{
    render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><AccountApp /><Location /></MemoryRouter>);await screen.findByRole("heading",{name:"Sales are nice. Profit is better."},{timeout:5000});fireEvent.click(screen.getByRole("link",{name:"Find my real profit"}));await screen.findByRole("heading",{name:"Phone login"});expect(screen.getByTestId("location").textContent).toBe("/login");
  });
  it("keeps protected data behind login and resumes the original route",async()=>{
    const ui=<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}} initialEntries={["/orders?sku=A"]}><AccountApp /><Location /></MemoryRouter>;
    const view=render(ui);await screen.findByRole("heading",{name:"Phone login"});state.user={uid:"owner"};view.rerender(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}} initialEntries={["/orders?sku=A"]}><AccountApp /><Location /></MemoryRouter>);await screen.findByRole("heading",{name:"Account dashboard"});expect(screen.getByTestId("location").textContent).toBe("/orders?sku=A");
  });
  it("includes the developer's supplied identity and Instagram link",async()=>{
    render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><AccountApp /></MemoryRouter>);await screen.findByRole("heading",{name:"Hi, I’m Chinmay Agrawal."});expect(screen.getByAltText("Chinmay Agrawal, developer of Meesho Profit Calculator").getAttribute("src")).toBe("/images/chinmay-agrawal.jpg");expect(screen.getByRole("link",{name:"Let’s connect @chinmay.agrawal._"}).getAttribute("href")).toBe("https://www.instagram.com/chinmay.agrawal._/");
  });
});
