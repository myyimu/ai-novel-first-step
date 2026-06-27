import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class WorkspaceProjectDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;
}

export class RevisionSessionDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  createdAt!: string;

  @IsString()
  chapterTitle!: string;

  @IsString()
  genre!: string;

  @IsString()
  inputKind!: string;

  @IsString()
  textHash!: string;

  @IsNumber()
  textLength!: number;

  @IsNumber()
  quickScore!: number;

  @IsString()
  gateDecision!: string;

  @IsString()
  mainProblem!: string;

  @IsArray()
  issueTitles!: string[];

  @IsOptional()
  @IsArray()
  issueCategories?: string[];

  @IsOptional()
  @IsString()
  nextPrompt?: string;

  @IsOptional()
  @IsString()
  revisionNote?: string;

  @IsOptional()
  @IsString()
  revisionNoteUpdatedAt?: string;

  @IsArray()
  methodologyCardIds!: string[];
}

export class ProjectMethodologyCardDto {
  @IsString()
  id!: string;

  @IsString()
  projectCardId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  sourceIssueId!: string;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  triggerProblem!: string;

  @IsString()
  reusableRule!: string;

  @IsString()
  selfCheckQuestion!: string;

  @IsOptional()
  @IsString()
  promptTemplate?: string;

  @IsString()
  firstSeenAt!: string;

  @IsString()
  lastSeenAt!: string;

  @IsString()
  sourceChapterTitle!: string;

  @IsOptional()
  @IsString()
  sourceIssueTitle?: string;

  @IsNumber()
  occurrenceCount!: number;

  @IsOptional()
  @IsNumber()
  usageCount?: number;
}

export class UpsertWorkspaceProjectDto {
  @ValidateNested()
  @Type(() => WorkspaceProjectDto)
  project!: WorkspaceProjectDto;
}

export class UpsertRevisionAssetsDto {
  @ValidateNested()
  @Type(() => WorkspaceProjectDto)
  project!: WorkspaceProjectDto;

  @ValidateNested()
  @Type(() => RevisionSessionDto)
  session!: RevisionSessionDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMethodologyCardDto)
  methodologyCards!: ProjectMethodologyCardDto[];
}

export class UpdateRevisionNoteDto {
  @IsString()
  note!: string;

  @IsOptional()
  @IsString()
  updatedAt?: string;
}
