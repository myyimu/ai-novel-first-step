import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { type Response } from "express";
import { Public } from "@/core/decorators/public.decorators";
import {
  UpdateRevisionNoteDto,
  UpsertRevisionAssetsDto,
  UpsertWorkspaceProjectDto,
} from "./dto/workspace-assets.dto";
import { buildWorkspaceProjectMarkdown } from "./workspace-assets-export";
import { WorkspaceAssetsRepository } from "./workspace-assets.repository";

@ApiTags("analysis")
@Controller("analysis/workspace")
export class WorkspaceController {
  constructor(
    private readonly workspaceAssets: WorkspaceAssetsRepository,
  ) {}

  @Get("assets")
  @Public()
  @ApiOperation({
    summary:
      "Read persisted workspace projects, revisions, and methodology cards",
  })
  listWorkspaceAssets() {
    return this.workspaceAssets.listAssets();
  }

  @Post("projects")
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: "Create or update a workspace project" })
  upsertWorkspaceProject(@Body() body: UpsertWorkspaceProjectDto) {
    return this.workspaceAssets.upsertProject(body.project);
  }

  @Post("revision-assets")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Persist one revision session and its methodology cards",
  })
  upsertRevisionAssets(@Body() body: UpsertRevisionAssetsDto) {
    return this.workspaceAssets.upsertRevisionAssets({
      project: body.project,
      session: body.session,
      methodologyCards: body.methodologyCards,
    });
  }

  @Patch("revision-sessions/:sessionId/note")
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: "Persist a human note for a revision session" })
  updateRevisionNote(
    @Param("sessionId") sessionId: string,
    @Body() body: UpdateRevisionNoteDto,
  ) {
    return this.workspaceAssets.updateRevisionNote({
      sessionId,
      note: body.note,
      updatedAt: body.updatedAt,
    });
  }

  @Get("projects/:projectId/export")
  @Public()
  @ApiOperation({ summary: "Export a persisted workspace project as Markdown" })
  async exportWorkspaceProject(
    @Param("projectId") projectId: string,
    @Res() response: Response,
  ) {
    const projectPackage =
      await this.workspaceAssets.readProjectPackage(projectId);
    const content = buildWorkspaceProjectMarkdown(projectPackage);
    const filename = `ai-novel-diagnosis-${projectPackage.project.name}-${new Date()
      .toISOString()
      .slice(0, 10)}.md`;
    response.setHeader("content-type", "text/markdown;charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    response.send(content);
  }
}
