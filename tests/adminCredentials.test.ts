import { describe,expect,it } from "vitest";
import { BackendConfigurationError,readAdminCredentials } from "../server/adminCredentials";
const account={project_id:"meesho-profit-calculator-99652",client_email:"test@example.iam.gserviceaccount.com",private_key:"-----BEGIN PRIVATE KEY-----\\nTEST-ONLY-NOT-A-REAL-KEY\\n-----END PRIVATE KEY-----"};
describe("server credential configuration",()=>{
  it("accepts the complete JSON variable and normalizes escaped newlines",()=>{
    const credentials=readAdminCredentials({FIREBASE_SERVICE_ACCOUNT_KEY:JSON.stringify(account)});
    expect(credentials.projectId).toBe(account.project_id);expect(credentials.privateKey).toContain("\n");expect(credentials.privateKey).not.toContain("\\n");
  });
  it("fails closed for absent, invalid or wrong-project credentials",()=>{
    expect(()=>readAdminCredentials({})).toThrow(BackendConfigurationError);
    expect(()=>readAdminCredentials({FIREBASE_SERVICE_ACCOUNT_KEY:"broken JSON"})).toThrow(BackendConfigurationError);
    expect(()=>readAdminCredentials({FIREBASE_SERVICE_ACCOUNT_KEY:JSON.stringify({...account,project_id:"another-project"})})).toThrow("different Firebase project");
  });
  it("does not include submitted credential contents in setup errors",()=>{
    try {readAdminCredentials({FIREBASE_SERVICE_ACCOUNT_KEY:"private-value-not-json"});}catch(error){expect(String(error)).not.toContain("private-value-not-json");}
  });
});
