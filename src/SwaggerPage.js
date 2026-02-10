import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

function SwaggerPage() {
  return (
    <div style={{ height: "100vh" }}>
      <SwaggerUI url="/gallicagram_swagger.yml" />
    </div>
  );
}

export default SwaggerPage;
