import { exec } from "child_process";
exec("npm install react-leaflet-cluster react-leaflet@4.2.1 --legacy-peer-deps", (error, stdout, stderr) => {
  console.log("stdout:", stdout);
  console.log("stderr:", stderr);
  if (error) {
    console.error("error:", error);
  }
});