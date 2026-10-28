// @vitest-environment jsdom
import React from "react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks=vi.hoisted(()=>({send:vi.fn(),confirm:vi.fn(),clear:vi.fn(),verifier:vi.fn()}));
vi.mock("@/config/firebase",()=>({auth:{}}));
vi.mock("firebase/auth",()=>({
  RecaptchaVerifier:vi.fn(function(...args:unknown[]){mocks.verifier(...args);return {clear:mocks.clear};}),
  signInWithPhoneNumber:(...args:unknown[])=>mocks.send(...args),
}));
import LoginPage from "@/pages/LoginPage";
beforeEach(()=>{vi.clearAllMocks();mocks.send.mockResolvedValue({confirm:mocks.confirm});mocks.confirm.mockResolvedValue({});});
afterEach(()=>cleanup());
function openLogin(){render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><LoginPage /></MemoryRouter>);}
function requestCode(){fireEvent.change(screen.getByLabelText("Phone number"),{target:{value:"9876543210"}});fireEvent.click(screen.getByRole("button",{name:"Continue with phone"}));}
describe("phone login flow",()=>{
  it("rejects invalid numbers without contacting Firebase",async()=>{
    openLogin();fireEvent.change(screen.getByLabelText("Phone number"),{target:{value:"123"}});fireEvent.click(screen.getByRole("button",{name:"Continue with phone"}));
    expect(await screen.findByRole("alert")).toBeTruthy();expect(mocks.send).not.toHaveBeenCalled();expect(mocks.verifier).not.toHaveBeenCalled();
  });
  it("uses supported invisible verification and shows the code step",async()=>{
    openLogin();requestCode();await screen.findByLabelText("Your 6-digit code");
    expect(mocks.verifier.mock.calls[0][2]).toEqual({size:"invisible"});expect(mocks.send.mock.calls[0][1]).toBe("+919876543210");
    expect(screen.getByLabelText("Your 6-digit code").getAttribute("autocomplete")).toBe("one-time-code");
    expect(screen.getByRole("button",{name:"Resend code in 60s"}).hasAttribute("disabled")).toBe(true);
  });
  it("verifies only the code entered by the user and clears verification on unmount",async()=>{
    openLogin();requestCode();const input=await screen.findByLabelText("Your 6-digit code");fireEvent.change(input,{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Verify & open dashboard"}));
    await waitFor(()=>expect(mocks.confirm).toHaveBeenCalledWith("123456"));cleanup();expect(mocks.clear).toHaveBeenCalled();
  });
  it("shows incorrect-code feedback and lets users change their number",async()=>{
    mocks.confirm.mockRejectedValueOnce({code:"auth/invalid-verification-code"});openLogin();requestCode();fireEvent.change(await screen.findByLabelText("Your 6-digit code"),{target:{value:"111111"}});fireEvent.click(screen.getByRole("button",{name:"Verify & open dashboard"}));
    expect((await screen.findByRole("alert")).textContent).toContain("incorrect");fireEvent.click(screen.getByRole("button",{name:"Use a different number"}));expect(screen.getByLabelText("Phone number")).toBeTruthy();
  });
});
