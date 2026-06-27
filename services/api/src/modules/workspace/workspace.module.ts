import { Module } from "@nestjs/common";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceAssetsRepository } from "./workspace-assets.repository";

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceAssetsRepository],
})
export class WorkspaceModule {}
